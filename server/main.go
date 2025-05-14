package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"

	// Add Kubernetes imports
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type StarknetEventFilter struct {
	ContractAddress string   `json:"address"`
	Keys           [][]string `json:"keys,omitempty"`
	FromBlock      interface{} `json:"from_block,omitempty"`
	ToBlock        interface{} `json:"to_block,omitempty"`
	ChunkSize      int         `json:"chunk_size,omitempty"`
}

// EventEmittedFilter represents the specific filter for EventEmitted events
type EventEmittedFilter struct {
	ContractAddress string   `json:"address"`
	Keys           [][]string `json:"keys,omitempty"`
	FromBlock      interface{} `json:"from_block,omitempty"`
	ToBlock        interface{} `json:"to_block,omitempty"`
	ChunkSize      int         `json:"chunk_size,omitempty"`
}

type StarknetConfig struct {
	NodeURL     string `json:"node_url"`
	NetworkName string `json:"network_name"`
}

type EventPayload struct {
	EventID     string            `json:"event_id"`
	EventType   string            `json:"event_type"`
	Payload     map[string]any    `json:"payload"`
	Environment map[string]string `json:"environment,omitempty"`
}

// Starknet RPC request/response types
type StarknetRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type StarknetRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
	ID int `json:"id"`
}

type StarknetEvent struct {
	BlockNumber     int      `json:"block_number"`
	BlockHash       string   `json:"block_hash"`
	TransactionHash string   `json:"transaction_hash"`
	FromAddress     string   `json:"from_address"`
	Keys            []string `json:"keys"`
	Data            []string `json:"data"`
	EventIndex      int      `json:"event_index"`
}

var (
	// Add Kubernetes clientset
	kubernetesClientset *kubernetes.Clientset

	httpClient *http.Client
	log        = logrus.New()

	// WebSocket upgrader
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins in development
		},
	}

	// API Keys from environment variables
	anthropicAPIKey  = os.Getenv("ANTHROPIC_API_KEY")
	openaiAPIKey     = os.Getenv("OPENAI_API_KEY")
	openrouterAPIKey = os.Getenv("OPENROUTER_API_KEY")

	// Command line flags
	startBlockNumber = flag.Int("block", 756800, "Block number to start listening from (0 means latest)")
	contractAddress  = flag.String("contract", "0x198cbb29ed691e3e143da013736cb32d2eb35835414e0c5ba758f44265d7a52", "Contract address to listen for events")
	eventSelector    = flag.String("selector", "0x4843fbb65c717bb5ece80d635a568aa1c688f880f0519e3de18bf3bae89abf8", "Event selector to filter for")
	caseInsensitive  = flag.Bool("case-insensitive", true, "Whether to do case-insensitive comparison for the selector")
	partialMatch     = flag.Bool("partial-match", true, "Whether to allow partial matches for the selector")
	envFile          = flag.String("env-file", ".env", "Path to the .env file")
	batchSize        = flag.Int("batch-size", 30, "Number of blocks to process in each batch")
	kubeconfigPath   = flag.String("kubeconfig", "", "Path to kubeconfig file (optional, defaults to ~/.kube/config or in-cluster)")
	namespace        = flag.String("namespace", "my-agents", "Kubernetes namespace to launch jobs in")
	agentImage       = flag.String("agent-image", "dreams-agents-client:latest", "Docker image for the agent container")
	agentServiceAccount = flag.String("chairman-server-sa", "", "ServiceAccount name for agent pods (optional)")
	
	// Default Starknet configuration
	defaultStarknetConfig = StarknetConfig{
		NodeURL:     "https://starknet-sepolia.blastapi.io/de586456-fa13-4575-9e6c-b73f9a88bc97/rpc/v0_7",  // Using Blast API as default
		NetworkName: "sepolia",
	}

	// Default event filter using the new EventEmittedFilter structure
	defaultEventFilter = StarknetEventFilter{
		ContractAddress: "0x198cbb29ed691e3e143da013736cb32d2eb35835414e0c5ba758f44265d7a52",
		FromBlock:      "latest",  // Start from latest block by default
		// Filter for EventEmitted events with the specific selector
		Keys:          [][]string{},
		ChunkSize:     100,  // Default chunk size
	}

	// Default EventEmitted filter specifically for EventEmitted events
	defaultEventEmittedFilter = EventEmittedFilter{
		ContractAddress: "0x198cbb29ed691e3e143da013736cb32d2eb35835414e0c5ba758f44265d7a52",
		Keys:          [][]string{}, // Empty keys array to get all events
		FromBlock:      "latest", // Will be updated based on command line flags
		ChunkSize:      100,
	}
)

func init() {
	// Parse command line flags
	flag.Parse()
	
	log = logrus.New()
	log.SetOutput(os.Stdout) // Direct logs to standard output

	// Load .env file
	if err := godotenv.Load(*envFile); err != nil {
		log.Warnf("Error loading .env file from %s: %v", *envFile, err)
		log.Info("Continuing with environment variables from the system")
	} else {
		log.Infof("Successfully loaded .env file from %s", *envFile)
	}
	
	// Get API keys from environment variables
	anthropicAPIKey = os.Getenv("ANTHROPIC_API_KEY")
	openaiAPIKey = os.Getenv("OPENAI_API_KEY")
	openrouterAPIKey = os.Getenv("OPENROUTER_API_KEY")
	
	// Set log level to debug
	log.SetLevel(logrus.DebugLevel)
	
	// Check if API keys are set
	if anthropicAPIKey == "" {
		log.Warn("ANTHROPIC_API_KEY environment variable not set")
	}
	if openaiAPIKey == "" {
		log.Warn("OPENAI_API_KEY environment variable not set")
	}
	if openrouterAPIKey == "" {
		log.Warn("OPENROUTER_API_KEY environment variable not set")
	}
	
	var config *rest.Config
	var err error

	// Try in-cluster config first
	config, err = rest.InClusterConfig()
	if err != nil {
		log.Warnf("Failed to get in-cluster config: %v. Trying kubeconfig.", err)
		// Fall back to kubeconfig
		// Use user-provided path or default kubeconfig location
		var kubeconfigPathResolved string
		if *kubeconfigPath != "" {
			kubeconfigPathResolved = *kubeconfigPath
		} else {
			// Use clientcmd convenience function to find default kubeconfig path
			// This avoids needing the homedir import directly here
			loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
			kubeconfigPathResolved = loadingRules.GetDefaultFilename()
		}

		if _, errStat := os.Stat(kubeconfigPathResolved); os.IsNotExist(errStat) {
			log.Fatalf("Kubeconfig file not found at %s and not running in-cluster.", kubeconfigPathResolved)
		}

		config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPathResolved) // Use clientcmd here
		if err != nil {
			log.Fatalf("Failed to build config from kubeconfig %s: %v", kubeconfigPathResolved, err)
		}
		log.Infof("Using kubeconfig: %s", kubeconfigPathResolved)
	} else {
		log.Info("Using in-cluster Kubernetes config")
	}

	// Fix: Pass only the config to NewForConfig
	kubernetesClientset, err = kubernetes.NewForConfig(config) // Remove second argument
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}
	log.Info("Successfully created Kubernetes client")

	// Initialize HTTP client
	httpClient = &http.Client{
		Timeout: 30 * time.Second,
	}

	// Update the filter based on command line flags
	if *contractAddress != "" {
		defaultEventEmittedFilter.ContractAddress = *contractAddress
	}
	
	// We're not setting the Keys filter anymore to get all events
	// Instead, we'll filter in the handleEventEmitted function
	
	// Set the starting block based on command line flags
	if *startBlockNumber > 0 {
		defaultEventEmittedFilter.FromBlock = map[string]interface{}{
			"block_number": *startBlockNumber,
		}
		log.Infof("Starting from block number: %d", *startBlockNumber)
	} else {
		defaultEventEmittedFilter.FromBlock = "latest"
		log.Info("Starting from latest block")
	}

	// Start listening for events automatically
	ctx := context.Background()
	// Use the EventEmitted filter instead of the general filter
	go startEventEmittedListener(ctx, defaultStarknetConfig, defaultEventEmittedFilter)
	log.Infof("Started Starknet EventEmitted listener for contract: %s", defaultEventEmittedFilter.ContractAddress)
}

func callStarknetRPC(nodeURL string, method string, params []interface{}) (*StarknetRPCResponse, error) {
	request := StarknetRPCRequest{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      1,
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// Log the request for debugging
	log.Debugf("Starknet RPC request: %s %s", method, string(requestBody))

	resp, err := httpClient.Post(nodeURL, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	// Log the response for debugging
	log.Debugf("Starknet RPC response: %s", string(body))

	var response StarknetRPCResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	if response.Error != nil {
		return nil, fmt.Errorf("RPC error: %s", response.Error.Message)
	}

	return &response, nil
}

func getLatestBlockHash(ctx context.Context, config StarknetConfig) (string, error) {
	response, err := callStarknetRPC(config.NodeURL, "starknet_blockHashAndNumber", []interface{}{})
	if err != nil {
		return "", err
	}

	var result struct {
		BlockHash string `json:"block_hash"`
		BlockNumber uint64 `json:"block_number"`
	}
	if err := json.Unmarshal(response.Result, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal block hash: %v", err)
	}

	return result.BlockHash, nil
}

func getEvents(ctx context.Context, config StarknetConfig, blockHash string, filter StarknetEventFilter) ([]StarknetEvent, error) {
	// Create a copy of the filter and set the block hash
	eventFilter := filter
	
	// If blockHash is provided, set the from_block to the provided block hash
	// Otherwise, use the filter's FromBlock (which could be a block number)
	if blockHash != "" {
		eventFilter.FromBlock = map[string]string{
			"block_hash": blockHash,
		}
	}
	
	// Set a default chunk size if not specified
	if eventFilter.ChunkSize == 0 {
		eventFilter.ChunkSize = 100
	}
	
	// Log the request for debugging
	filterJSON, _ := json.Marshal(eventFilter)
	log.Debugf("Starknet getEvents filter: %s", string(filterJSON))
	
	// Call RPC with the filter as a single parameter
	response, err := callStarknetRPC(config.NodeURL, "starknet_getEvents", []interface{}{
		eventFilter, // Single parameter: the filter object
	})
	
	if err != nil {
		return nil, err
	}

	var result struct {
		Events []StarknetEvent `json:"events"`
		ContinuationToken string `json:"continuation_token,omitempty"`
	}
	if err := json.Unmarshal(response.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal events: %v", err)
	}

	return result.Events, nil
}

// getBlockNumber gets a block number from a block hash
func getBlockNumber(ctx context.Context, config StarknetConfig, blockHash string) (int, error) {
	response, err := callStarknetRPC(config.NodeURL, "starknet_getBlockWithTxs", []interface{}{
		map[string]string{"block_hash": blockHash},
	})
	if err != nil {
		return 0, err
	}

	var result struct {
		BlockNumber int `json:"block_number"`
	}
	if err := json.Unmarshal(response.Result, &result); err != nil {
		return 0, fmt.Errorf("failed to unmarshal block number: %v", err)
	}

	return result.BlockNumber, nil
}

// startEventEmittedListener starts a listener specifically for EventEmitted events
func startEventEmittedListener(ctx context.Context, config StarknetConfig, filter EventEmittedFilter) {
	// Get the selector we're interested in
	selector := *eventSelector
	
	log.Infof("Starting Starknet EventEmitted listener for contract: %s", 
		filter.ContractAddress)
	log.Infof("Will filter for selector: %s in code", selector)
	log.Infof("Processing blocks in batches of %d", *batchSize)
	
	// Determine the starting block
	var currentBlockNumber int
	var err error
	
	// If FromBlock is "latest", get the latest block number
	if fromBlock, ok := filter.FromBlock.(string); ok && fromBlock == "latest" {
		blockHash, err := getLatestBlockHash(ctx, config)
		if err != nil {
			log.Errorf("Failed to get latest block hash: %v", err)
			return
		}
		
		currentBlockNumber, err = getBlockNumber(ctx, config, blockHash)
		if err != nil {
			log.Errorf("Failed to get block number for hash %s: %v", blockHash, err)
			return
		}
		
		log.Infof("Starting from latest block number: %d", currentBlockNumber)
	} else if fromBlockMap, ok := filter.FromBlock.(map[string]interface{}); ok {
		// If FromBlock is a map with block_number, use that
		if blockNum, ok := fromBlockMap["block_number"]; ok {
			switch v := blockNum.(type) {
			case int:
				currentBlockNumber = v
			case float64:
				currentBlockNumber = int(v)
			case string:
				currentBlockNumber, err = strconv.Atoi(v)
				if err != nil {
					log.Errorf("Invalid block number: %v", v)
					return
				}
			default:
				log.Errorf("Unsupported block number type: %T", blockNum)
				return
			}
			log.Infof("Starting from specified block number: %d", currentBlockNumber)
		}
	}
	
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	// Keep track of processed blocks to avoid duplicates
	processedBlocks := make(map[string]bool)

	for {
		select {
		case <-ctx.Done():
			log.Info("Stopping Starknet EventEmitted listener")
			return
		case <-ticker.C:
			// Get the latest block hash and number
			blockHash, err := getLatestBlockHash(ctx, config)
			if err != nil {
				log.Errorf("Failed to get latest block hash: %v", err)
				continue
			}
			
			latestBlockNumber, err := getBlockNumber(ctx, config, blockHash)
			if err != nil {
				log.Errorf("Failed to get block number for hash %s: %v", blockHash, err)
				continue
			}
			
			// Process blocks in batches
			for currentBlockNumber <= latestBlockNumber {
				// Calculate the end block number for this batch
				endBlockNumber := currentBlockNumber + *batchSize - 1
				if endBlockNumber > latestBlockNumber {
					endBlockNumber = latestBlockNumber
				}
				
				// Create a copy of the filter for this batch request
				requestFilter := filter
				
				// Set the from_block and to_block for the batch
				requestFilter.FromBlock = map[string]interface{}{
					"block_number": currentBlockNumber,
				}
				requestFilter.ToBlock = map[string]interface{}{
					"block_number": endBlockNumber,
				}
				
				log.Debugf("Checking for EventEmitted events in blocks %d to %d", currentBlockNumber, endBlockNumber)
				
				// Get events for this batch of blocks
				events, err := getEvents(ctx, config, "", StarknetEventFilter(requestFilter))
				if err != nil {
					log.Errorf("Failed to fetch Starknet EventEmitted events for blocks %d to %d: %v", 
						currentBlockNumber, endBlockNumber, err)
					break
				}
				
				if len(events) > 0 {
					log.Infof("Found %d events in blocks %d to %d", len(events), currentBlockNumber, endBlockNumber)
					
					// Group events by block number for better logging
					eventsByBlock := make(map[int][]StarknetEvent)
					for _, event := range events {
						eventsByBlock[event.BlockNumber] = append(eventsByBlock[event.BlockNumber], event)
					}
					
					// Process events for each block
					for blockNum, blockEvents := range eventsByBlock {
						log.Infof("Processing %d events in block %d", len(blockEvents), blockNum)
						
						for i, event := range blockEvents {
							// Log the event details for debugging
							keysJSON, _ := json.Marshal(event.Keys)
							log.Infof("Event %d in block %d: Keys: %s", i, blockNum, string(keysJSON))
							
							// Create event payload
							eventPayload := EventPayload{
								EventID:   fmt.Sprintf("starknet-emitted-%d-%s-%d", blockNum, event.TransactionHash, event.EventIndex),
								EventType: "starknet_event_emitted",
								Payload: map[string]any{
									"block_number":     blockNum,
									"transaction_hash": event.TransactionHash,
									"contract_address": event.FromAddress,
									"keys":            event.Keys,
									"data":            event.Data,
									"event_index":     event.EventIndex,
									"selector":        *eventSelector,
								},
								Environment: map[string]string{
									"STARKNET_NETWORK": config.NetworkName,
									"CONTRACT_ADDRESS": event.FromAddress,
									"EVENT_SELECTOR":   *eventSelector,
									"BLOCK_NUMBER":     fmt.Sprintf("%d", blockNum),
								},
							}
							
							// Handle the event by creating a container
							handleEventEmitted(eventPayload)
						}
					}
				} else {
					log.Debugf("No events found in blocks %d to %d", currentBlockNumber, endBlockNumber)
				}
				
				// Mark these blocks as processed
				for blockNum := currentBlockNumber; blockNum <= endBlockNumber; blockNum++ {
					processedBlocks[fmt.Sprintf("%d", blockNum)] = true
				}
				
				// Move to the next batch
				currentBlockNumber = endBlockNumber + 1
			}
			
			// Limit the size of processedBlocks to avoid memory leaks
			if len(processedBlocks) > 1000 {
				// Remove oldest entries (this is a simple approach)
				for k := range processedBlocks {
					delete(processedBlocks, k)
					if len(processedBlocks) <= 500 {
						break
					}
				}
			}
		}
	}
}

// handleEventEmitted specifically handles EventEmitted events
func handleEventEmitted(event EventPayload) {
	// Extract the keys from the event payload
	keys, ok := event.Payload["keys"].([]string)
	if !ok || len(keys) == 0 {
		log.Warnf("Event %s has no keys or invalid keys format", event.EventID)
		return
	}

	// Extract the data/values from the event payload
	var data []string
	if dataInterface, ok := event.Payload["data"].([]string); ok {
		data = dataInterface
	} else if dataInterface, ok := event.Payload["values"].([]string); ok {
		// Some events might use "values" instead of "data"
		data = dataInterface
	} else {
		// If data is not available in the payload, try to get it from the original event
		log.Warnf("Event %s has no data or invalid data format in payload", event.EventID)
		// Continue processing even if data is not available
		data = []string{}
	}

	// Get the selector we're interested in
	targetSelector := *eventSelector
	
	// Convert to lowercase if case-insensitive comparison is enabled
	var normalizedTargetSelector string
	if *caseInsensitive {
		normalizedTargetSelector = strings.ToLower(targetSelector)
	} else {
		normalizedTargetSelector = targetSelector
	}

	// Log all keys for debugging
	keysJSON, _ := json.Marshal(keys)
	log.Infof("Event %s has keys: %s", event.EventID, string(keysJSON))

	// Log all data for debugging
	dataJSON, _ := json.Marshal(data)
	log.Infof("Event %s has data: %s", event.EventID, string(dataJSON))

	// Check if this is an EventEmitted event with the specific selector
	// The selector could be any of the keys, not just the first one
	selectorFound := false
	matchedKey := ""
	for _, key := range keys {
		// Normalize the key if case-insensitive comparison is enabled
		var normalizedKey string
		if *caseInsensitive {
			normalizedKey = strings.ToLower(key)
		} else {
			normalizedKey = key
		}
		
		// Check for exact match first
		if normalizedKey == normalizedTargetSelector {
			selectorFound = true
			matchedKey = key
			log.Infof("Found exact matching selector %s in event keys (original key: %s)", targetSelector, key)
			break
		}
		
		// If partial matching is enabled, check for substring matches
		if *partialMatch {
			if strings.Contains(normalizedKey, normalizedTargetSelector) {
				selectorFound = true
				matchedKey = key
				log.Infof("Found partial matching selector %s in event key %s (selector is substring of key)", targetSelector, key)
				break
			}
			
			if strings.Contains(normalizedTargetSelector, normalizedKey) {
				selectorFound = true
				matchedKey = key
				log.Infof("Found partial matching selector %s in event key %s (key is substring of selector)", targetSelector, key)
				break
			}
		}
	}

	if !selectorFound {
		// This is not an error, just not the event we're looking for
		log.Debugf("Skipping event %s as it doesn't contain our selector %s", event.EventID, targetSelector)
		return
	}

	log.Infof("Processing EventEmitted event with selector: %s, matched key: %s", targetSelector, matchedKey)

	// Generate a Kubernetes-compatible job name (DNS-1123 subdomain)
	// Max length 63 chars, lowercase alphanumeric, '-', start/end with alphanumeric
	jobNameBase := fmt.Sprintf("agent-%s", event.EventID)
	// Sanitize and shorten if necessary
	jobNameBase = strings.ToLower(jobNameBase)
	jobNameBase = strings.ReplaceAll(jobNameBase, "_", "-") // Replace underscores
	// Replace any invalid characters (example: keep only a-z, 0-9, -)
	var sanitizedName strings.Builder
	for _, r := range jobNameBase {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			sanitizedName.WriteRune(r)
		}
	}
	jobNameBase = sanitizedName.String()
	if len(jobNameBase) > 50 { // Leave room for potential suffix
		jobNameBase = jobNameBase[:50]
	}
	// Ensure it doesn't end with '-'
	jobNameBase = strings.TrimSuffix(jobNameBase, "-")
	// Add a timestamp or random suffix to ensure uniqueness if needed, though Job controller handles this.
	// Let's use the base name directly for now. Kubernetes will add a unique suffix to the Pod name.
	jobName := jobNameBase

	// Sanitize and truncate label values
	sanitizedEventID := sanitizeAndTruncateLabelValue(event.EventID)
	sanitizedSelector := sanitizeAndTruncateLabelValue(targetSelector)

	// Prepare environment variables for the agent Pod
	envVars := []v1.EnvVar{
		{Name: "EVENT_ID", Value: sanitizedEventID},
		{Name: "EVENT_TYPE", Value: event.EventType},
		{Name: "EVENT_SELECTOR", Value: sanitizedSelector},
		// Add keys
		{Name: "EVENT_KEYS_JSON", Value: toJsonString(keys)}, // Pass keys as JSON string
		// Add data
		{Name: "EVENT_DATA_JSON", Value: toJsonString(data)}, // Pass data as JSON string
	}
	
	// Add EVENT_KEY_N and EVENT_DATA_N if needed by the agent, but JSON is often easier
	/*
	for i, key := range keys {
		envVars = append(envVars, v1.EnvVar{Name: fmt.Sprintf("EVENT_KEY_%d", i), Value: key})
	}
	for i, val := range data {
		envVars = append(envVars, v1.EnvVar{Name: fmt.Sprintf("EVENT_DATA_%d", i), Value: val})
	}
	*/
	
	// Add other environment variables from the event payload
	if event.Environment != nil {
		for k, v := range event.Environment {
			// Skip API keys here, use Secrets or downward API for those in agent
			if k != "ANTHROPIC_API_KEY" && k != "OPENAI_API_KEY" && k != "OPENROUTER_API_KEY" {
				envVars = append(envVars, v1.EnvVar{Name: k, Value: v})
			}
		}
	}
	
	// **IMPORTANT**: Add API Keys securely. Best practice is using Kubernetes Secrets.
	// Option 1: Mount Secrets as Env Vars (Recommended)
	// Assumes you have Secrets named 'agent-api-keys' with keys 'anthropic-api-key', 'openai-api-key', etc.
	envVars = append(envVars, v1.EnvVar{
		Name: "ANTHROPIC_API_KEY",
		ValueFrom: &v1.EnvVarSource{
			SecretKeyRef: &v1.SecretKeySelector{
				LocalObjectReference: v1.LocalObjectReference{Name: "agent-api-keys"}, // CHANGE_ME: Your secret name
				Key:                  "anthropic-api-key",        // CHANGE_ME: Key within the secret
				Optional:             func(b bool) *bool { return &b }(true), // Make optional if key might not exist
			},
		},
	})
	envVars = append(envVars, v1.EnvVar{
		Name: "OPENAI_API_KEY",
		ValueFrom: &v1.EnvVarSource{
			SecretKeyRef: &v1.SecretKeySelector{
				LocalObjectReference: v1.LocalObjectReference{Name: "agent-api-keys"}, // CHANGE_ME
				Key:                  "openai-api-key",         // CHANGE_ME
				Optional:             func(b bool) *bool { return &b }(true),
			},
		},
	})
	envVars = append(envVars, v1.EnvVar{
		Name: "OPENROUTER_API_KEY",
		ValueFrom: &v1.EnvVarSource{
			SecretKeyRef: &v1.SecretKeySelector{
				LocalObjectReference: v1.LocalObjectReference{Name: "agent-api-keys"}, // CHANGE_ME
				Key:                  "openrouter-api-key",     // CHANGE_ME
				Optional:             func(b bool) *bool { return &b }(true),
			},
		},
	})
	
	// Option 2: Pass keys from server env (Less Secure, only for testing/simplicity if needed)
	/*
	 if anthropicAPIKey != "" { envVars = append(envVars, v1.EnvVar{Name: "ANTHROPIC_API_KEY", Value: anthropicAPIKey}) }
	 if openaiAPIKey != "" { envVars = append(envVars, v1.EnvVar{Name: "OPENAI_API_KEY", Value: openaiAPIKey}) }
	 if openrouterAPIKey != "" { envVars = append(envVars, v1.EnvVar{Name: "OPENROUTER_API_KEY", Value: openrouterAPIKey}) }
	*/

	// Define the Job
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: *namespace,
			Labels: map[string]string{ // Labels for finding/managing jobs later
				"app":       "chairman-agent",
				"event-id":  sanitizedEventID, // Use sanitized value
				"selector":  sanitizedSelector, // Use sanitized value
			},
		},
		Spec: batchv1.JobSpec{
			// TTLSecondsAfterFinished: PtrInt32(3600), // Optional: Auto-cleanup finished jobs after 1 hour
			BackoffLimit: PtrInt32(1), // Optional: Retry once on failure
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{ // Pods also get labels
						"app":      "chairman-agent",
						"event-id": sanitizedEventID, // Use sanitized value
					},
				},
				Spec: v1.PodSpec{
					Containers: []v1.Container{
						{
							Name:  "agent-container",
							Image: *agentImage, // Use the image specified by flag
							Env:   envVars,
							// Add resource requests/limits if known
							/*
							Resources: v1.ResourceRequirements{
								Requests: v1.ResourceList{
									v1.ResourceCPU:    resource.MustParse("100m"), // 0.1 CPU core
									v1.ResourceMemory: resource.MustParse("128Mi"), // 128 MiB RAM
								},
								Limits: v1.ResourceList{
									v1.ResourceCPU:    resource.MustParse("500m"), // 0.5 CPU core
									v1.ResourceMemory: resource.MustParse("512Mi"), // 512 MiB RAM
								},
							},
							*/
						},
					},
					RestartPolicy: v1.RestartPolicyNever, // Or OnFailure if container might exit non-zero legitimately
					// Assign a ServiceAccount if the agent needs specific K8s permissions
					ServiceAccountName: *agentServiceAccount,
				},
			},
		},
	}

	// Create the Job in Kubernetes
	log.Debugf("Attempting to create Kubernetes Job: %s in namespace: %s", jobName, *namespace)
	_, err := kubernetesClientset.BatchV1().Jobs(*namespace).Create(context.Background(), job, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create Kubernetes Job %s for event %s: %v", jobName, event.EventID, err)
		// Handle error (e.g., retry logic, specific error checks like "already exists")
		return
	}

	log.Infof("Kubernetes Job %s created successfully for event %s", jobName, event.EventID)
}

// Helper to convert slices/maps to JSON strings safely
func toJsonString(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		log.Warnf("Failed to marshal to JSON: %v", err)
		return "" // Or return "[]" or "{}" depending on expected type
	}
	return string(b)
}

// Regular expression for valid Kubernetes label values (simplified)
// Allows alphanumerics, '-', '_', '.' in the middle.
var labelValueRegex = regexp.MustCompile(`^[a-zA-Z0-9]([-a-zA-Z0-9_.]*[a-zA-Z0-9])?$`) // Matches start/end alphanumeric
var invalidLabelCharsRegex = regexp.MustCompile(`[^a-zA-Z0-9-_.]`) // Finds characters to replace

// sanitizeAndTruncateLabelValue ensures a string is a valid Kubernetes label value.
func sanitizeAndTruncateLabelValue(value string) string {
	// Replace 0x prefix if present, common in selectors/hashes
	value = strings.TrimPrefix(value, "0x")
	
	// Convert to lower case
	value = strings.ToLower(value)

	// Replace invalid characters with hyphen
	value = invalidLabelCharsRegex.ReplaceAllString(value, "-")

	// Trim leading/trailing hyphens or dots
	value = strings.Trim(value, "-.")

	// Truncate to 63 characters if necessary
	if len(value) > 63 {
		value = value[:63]
	}

	// Ensure it still ends with alphanumeric after truncation
	value = strings.TrimRight(value, "-.") 

	// Handle empty string case after sanitization
	if value == "" {
		return "invalid-label" // Return a default valid label
	}

	// Ensure it starts with alphanumeric (less likely needed after above steps, but safe)
	if !((value[0] >= 'a' && value[0] <= 'z') || (value[0] >= '0' && value[0] <= '9')) {
		value = "l" + value[1:] // Prepend 'l' if first char is invalid (e.g., was '-')
		// Re-truncate if prepending made it too long
		if len(value) > 63 {
			value = value[:63]
		}
	}

	// Final check (optional, regex can be slow)
	// if !labelValueRegex.MatchString(value) {
	// 	log.Warnf("Label sanitization resulted in potentially invalid value: %s", value)
	// }

	return value
}

// Helper function to get pointer to int32 (needed for some K8s spec fields)
func PtrInt32(i int) *int32 {
	i32 := int32(i)
	return &i32
}

func handleEvent(c *gin.Context) {
	var event EventPayload
	if err := c.BindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Handling generic event: %s (type: %s)", event.EventID, event.EventType)

	// Generate Job Name (similar to handleEventEmitted)
	jobNameBase := fmt.Sprintf("generic-agent-%s", event.EventID)
	// (Add sanitization logic as above) ...
	jobName := jobNameBase // Simplified for example

	// Prepare Environment Variables
	envVars := []v1.EnvVar{
		{Name: "EVENT_ID", Value: event.EventID},
		{Name: "EVENT_TYPE", Value: event.EventType},
		// Add payload as JSON? Requires agent to parse.
		{Name: "EVENT_PAYLOAD_JSON", Value: toJsonString(event.Payload)},
	}
	if event.Environment != nil {
		for k, v := range event.Environment {
			if k != "ANTHROPIC_API_KEY" && k != "OPENAI_API_KEY" && k != "OPENROUTER_API_KEY" {
				envVars = append(envVars, v1.EnvVar{Name: k, Value: v})
			}
		}
	}
	// Add API Keys from Secrets (copy from handleEventEmitted)
	// ... envVars = append(envVars, v1.EnvVar{Name: "ANTHROPIC_API_KEY", ValueFrom: ...}) ...
	// ... etc for other keys ...

	// Define the Job (similar structure to handleEventEmitted)
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: *namespace,
			Labels: map[string]string{
				"app":        "chairman-agent-generic",
				"event-id":   event.EventID,
				"event-type": event.EventType, // Sanitize if needed
			},
		},
		Spec: batchv1.JobSpec{
			TTLSecondsAfterFinished: PtrInt32(0), // Auto-delete job immediately after completion
			BackoffLimit: PtrInt32(1),
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":      "chairman-agent-generic",
						"event-id": event.EventID,
					},
				},
				Spec: v1.PodSpec{
					Containers: []v1.Container{
						{
							Name:  "agent-container",
							Image: *agentImage,
							Env:   envVars,
							// Resources: ...
						},
					},
					RestartPolicy:      v1.RestartPolicyNever,
					ServiceAccountName: *agentServiceAccount,
				},
			},
		},
	}

	// Create Job
	log.Debugf("Attempting to create generic Kubernetes Job: %s in namespace: %s", jobName, *namespace)
	createdJob, err := kubernetesClientset.BatchV1().Jobs(*namespace).Create(context.Background(), job, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create generic Kubernetes Job %s: %v", jobName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create agent job"})
		return
	}

	log.Infof("Generic Kubernetes Job %s created successfully for event %s", createdJob.Name, event.EventID)
	c.JSON(http.StatusOK, gin.H{
		"jobName":   createdJob.Name,
		"namespace": createdJob.Namespace,
		"status":    "JobCreated", // Indicate job creation, status is async
		"eventId":   event.EventID,
	})
}

func getJobStatus(c *gin.Context) {
	jobName := c.Param("job_name") // Use job name as identifier

	job, err := kubernetesClientset.BatchV1().Jobs(*namespace).Get(context.Background(), jobName, metav1.GetOptions{})
	if err != nil {
		log.Warnf("Failed to get Job %s: %v", jobName, err)
		// Distinguish between "not found" and other errors
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Job %s not found in namespace %s", jobName, *namespace)})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error fetching job status: %v", err)})
		}
		return
	}

	// Extract relevant status info
	status := "Unknown"
	var completionTime *metav1.Time
	var startTime *metav1.Time

	if job.Status.Succeeded > 0 {
		status = "Succeeded"
		completionTime = job.Status.CompletionTime
	} else if job.Status.Failed > 0 {
		status = "Failed"
		// Could try to get failure reasons from Pod conditions if needed
		completionTime = job.Status.CompletionTime // Might be set even on failure
	} else if job.Status.Active > 0 {
		status = "Running"
		startTime = job.Status.StartTime
	} else if job.Status.StartTime != nil {
		// Has started but no active pods? Maybe pending or initializing.
		status = "Pending"
		startTime = job.Status.StartTime
	} else {
		// Not started yet?
		status = "Queued"
	}

	// Get event ID from labels if present
	eventID := job.Labels["event-id"] // Assuming we set this label

	c.JSON(http.StatusOK, gin.H{
		"jobName":        job.Name,
		"namespace":      job.Namespace,
		"status":         status,
		"createdAt":      job.CreationTimestamp,
		"startedAt":      startTime,       // May be nil
		"completedAt":    completionTime, // May be nil
		"eventId":        eventID,
		"activePods":     job.Status.Active,
		"succeededPods":  job.Status.Succeeded,
		"failedPods":     job.Status.Failed,
	})
}

func deleteJob(c *gin.Context) {
	jobName := c.Param("job_name") // Use job name

	log.Infof("Attempting to delete Job: %s in namespace: %s", jobName, *namespace)

	// Define deletion policy: Background propagation deletes dependents (Pods) in the background
	deletePolicy := metav1.DeletePropagationBackground

	err := kubernetesClientset.BatchV1().Jobs(*namespace).Delete(context.Background(), jobName, metav1.DeleteOptions{
		PropagationPolicy: &deletePolicy,
	})
	if err != nil {
		log.Errorf("Failed to delete Job %s: %v", jobName, err)
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Job %s not found", jobName)})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete job: %v", err)})
		}
		return
	}

	// Remove from any internal tracking if necessary
	// delete(activeJobs, eventID) // If using a map

	log.Infof("Job %s deleted successfully", jobName)
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Job %s marked for deletion", jobName),
	})
}

func streamJobLogs(c *gin.Context) {
	jobName := c.Param("job_name")

	// 1. Find the Pod(s) associated with the Job
	podList, err := kubernetesClientset.CoreV1().Pods(*namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("job-name=%s", jobName), // K8s automatically adds this label
	})
	if err != nil {
		log.Errorf("Failed to list pods for job %s: %v", jobName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find pods for job"})
		return
	}
	if len(podList.Items) == 0 {
		// Could be job hasn't created pod yet, or job is finished and pod cleaned up
		log.Warnf("No pods found for job %s (might be pending, completed, or failed)", jobName)
		c.JSON(http.StatusNotFound, gin.H{"error": "No active or recent pod found for job"})
		return
	}

	// For simplicity, stream logs from the first pod found.
	// A more robust solution might check pod status or aggregate logs.
	podName := podList.Items[0].Name
	log.Infof("Found pod %s for job %s. Attempting to stream logs.", podName, jobName)

	// Set CORS headers (Keep)
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Origin, Content-Type")
	if c.Request.Method == "OPTIONS" {
		c.Status(http.StatusOK)
		return
	}

	// Upgrade to WebSocket (Keep)
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade connection for job %s logs: %v", jobName, err)
		return
	}
	defer ws.Close()

	// 2. Stream logs from the selected Pod
	// Tail lines parameter - get from query? Default to reasonable number
	tailLines := int64(100) // Default
	if tailStr := c.Query("tail"); tailStr != "" {
		if i, err := strconv.ParseInt(tailStr, 10, 64); err == nil && i > 0 {
			tailLines = i
		}
	}
	follow := c.Query("follow") != "false" // Follow logs by default

	req := kubernetesClientset.CoreV1().Pods(*namespace).GetLogs(podName, &v1.PodLogOptions{
		Follow:     follow,    // Follow the logs
		Timestamps: true,      // Include timestamps
		TailLines:  &tailLines, // Start with the last N lines
		// Container: "agent-container", // Specify if multiple containers in pod
	})

	podLogs, err := req.Stream(context.Background())
	if err != nil {
		log.Errorf("Failed to stream logs for pod %s: %v", podName, err)
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error streaming logs: %v", err)))
		return
	}
	defer podLogs.Close()

	// Goroutine to copy logs from K8s stream to WebSocket (Keep similar structure)
	go func() {
		defer ws.Close()
		defer podLogs.Close()

		buf := make([]byte, 32*1024)
		for {
			n, err := podLogs.Read(buf)
			if n > 0 {
				// Use TextMessage as K8s logs are usually UTF-8 text
				if err := ws.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
					log.Warnf("Error writing logs to WebSocket for pod %s: %v", podName, err)
					return // Stop sending on write error
				}
				// Reset write deadline (Keep)
				ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			}
			if err != nil {
				if err != io.EOF {
					log.Warnf("Error reading logs from K8s stream for pod %s: %v", podName, err)
				} else {
					log.Infof("Log stream ended (EOF) for pod %s", podName)
				}
				ws.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Log stream ended"))
				return // Stop reading on EOF or other errors
			}
		}
	}()

	// Keep connection alive (Keep similar structure)
	for {
		// Reset read deadline (Keep)
		ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		messageType, message, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Warnf("WebSocket closed unexpectedly for job %s logs: %v", jobName, err)
			} else {
				log.Infof("WebSocket closed for job %s logs", jobName)
			}
			break // Exit loop on close or error
		}
		// Echo or handle client messages if needed (Keep)
		if err := ws.WriteMessage(messageType, message); err != nil {
			log.Warnf("Error writing echo to WebSocket for job %s logs: %v", jobName, err)
			break
		}
	}
}

// --- New Handler for Agent Death Signal ---
func handleAgentDeathSignal(c *gin.Context) {
	eventID := c.Param("event_id")
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing event_id parameter"})
		return
	}

	// IMPORTANT: Sanitize the received event ID exactly like when creating the job label
	sanitizedEventID := sanitizeAndTruncateLabelValue(eventID)
	log.Infof("Received death signal for event_id: %s (sanitized: %s)", eventID, sanitizedEventID)

	// Find the Job(s) using the sanitized event-id label
	listOptions := metav1.ListOptions{
		LabelSelector: fmt.Sprintf("event-id=%s", sanitizedEventID),
	}

	jobList, err := kubernetesClientset.BatchV1().Jobs(*namespace).List(context.Background(), listOptions)
	if err != nil {
		// Handle potential errors during list operation
		log.Errorf("Error listing jobs for event-id %s: %v", sanitizedEventID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":      fmt.Sprintf("Failed to list jobs for event ID %s", sanitizedEventID),
			"event_id":   eventID,
			"sanitized":  sanitizedEventID,
		})
		return
	}

	if len(jobList.Items) == 0 {
		log.Warnf("No jobs found with event-id label: %s", sanitizedEventID)
		c.JSON(http.StatusNotFound, gin.H{
			"error":      fmt.Sprintf("No job found for event ID %s", sanitizedEventID),
			"event_id":   eventID,
			"sanitized":  sanitizedEventID,
		})
		return
	}

	// Delete the found Job(s)
	var deletedJobs []string
	var deletionErrors []string
	deletePolicy := metav1.DeletePropagationBackground // Delete pods in background

	for _, job := range jobList.Items {
		jobName := job.Name
		log.Infof("Attempting to delete Job %s (found via event-id %s)", jobName, sanitizedEventID)
		err := kubernetesClientset.BatchV1().Jobs(*namespace).Delete(context.Background(), jobName, metav1.DeleteOptions{
			PropagationPolicy: &deletePolicy,
		})

		if err != nil {
			// Check if the error is 'Not Found' (maybe deleted by another process or TTL)
			if apierrors.IsNotFound(err) {
				log.Warnf("Job %s not found during deletion attempt (already deleted?)", jobName)
				// Optionally count this as success or ignore
			} else {
				log.Errorf("Failed to delete Job %s: %v", jobName, err)
				deletionErrors = append(deletionErrors, fmt.Sprintf("Failed to delete job %s: %v", jobName, err))
			}
		} else {
			log.Infof("Job %s marked for deletion successfully.", jobName)
			deletedJobs = append(deletedJobs, jobName)
		}
	}

	if len(deletionErrors) > 0 {
		// Return internal server error if any deletion failed (excluding not found)
		c.JSON(http.StatusInternalServerError, gin.H{
			"message":      fmt.Sprintf("Attempted deletion for event ID %s. Some errors occurred.", sanitizedEventID),
			"event_id":     eventID,
			"sanitized":    sanitizedEventID,
			"deleted_jobs": deletedJobs,
			"errors":       deletionErrors,
		})
	} else if len(deletedJobs) == 0 {
		// This case might happen if all jobs found were already deleted (only Not Found errors)
		c.JSON(http.StatusOK, gin.H{
			"message":      fmt.Sprintf("No active jobs found to delete for event ID %s (already deleted?).", sanitizedEventID),
			"event_id":     eventID,
			"sanitized":    sanitizedEventID,
		})
	} else {
		// Success
		c.JSON(http.StatusOK, gin.H{
			"message":      fmt.Sprintf("Successfully triggered deletion for job(s) associated with event ID %s", sanitizedEventID),
			"event_id":     eventID,
			"sanitized":    sanitizedEventID,
			"deleted_jobs": deletedJobs,
		})
	}
}

func main() {
	r := gin.Default()

	r.POST("/event", handleEvent)
	r.GET("/jobs/:job_name/status", getJobStatus)
	r.DELETE("/jobs/:job_name", deleteJob)
	r.GET("/jobs/:job_name/logs", streamJobLogs)

	// Add the new endpoint for agent death signals
	r.DELETE("/signal-death/:event_id", handleAgentDeathSignal)

	log.Info("Starting Dreams Kubernetes Agent Manager...")
	log.Infof("Listening for contract: %s", defaultEventEmittedFilter.ContractAddress)
	log.Infof("Event Selector: %s (Case-Insensitive: %v, Partial Match: %v)", *eventSelector, *caseInsensitive, *partialMatch)
	log.Infof("Target Kubernetes Namespace: %s", *namespace)
	log.Infof("Agent Image: %s", *agentImage)
	if *agentServiceAccount != "" {
		log.Infof("Using ServiceAccount for Agents: %s", *agentServiceAccount)
	}
	log.Infof("ANTHROPIC_API_KEY: %s (Expected via K8s Secret 'agent-api-keys')", maskAPIKey(anthropicAPIKey))
	log.Infof("OPENAI_API_KEY: %s (Expected via K8s Secret 'agent-api-keys')", maskAPIKey(openaiAPIKey))
	log.Infof("OPENROUTER_API_KEY: %s (Expected via K8s Secret 'agent-api-keys')", maskAPIKey(openrouterAPIKey))

	log.Infof("Listening on :8000")
	if err := r.Run(":8000"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func maskAPIKey(key string) string {
	if key == "" {
		return "not set in server env"
	}
	
	if len(key) <= 8 {
		return "****"
	}
	
	return key[:4] + "..." + key[len(key)-4:]
} 