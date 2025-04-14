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
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
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

type ContainerStatus struct {
	ContainerID string    `json:"container_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	EventID     string    `json:"event_id"`
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
	activeContainers = make(map[string]ContainerStatus)
	dockerClient     *client.Client
	httpClient       *http.Client
	log              = logrus.New()
	
	// Track the last container start time to enforce delay between startups
	lastContainerStartTime = time.Now().Add(-60 * time.Second)
	containerStartMutex    = &sync.Mutex{}

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
	startBlockNumber = flag.Int("block", 627461, "Block number to start listening from (0 means latest)")
	contractAddress  = flag.String("contract", "0x4726e48f50c7bfcb4eb7d89790fdf2718911207f3e8d90ada0caf36c4ff2c23", "Contract address to listen for events")
	eventSelector    = flag.String("selector", "0x4843fbb65c717bb5ece80d635a568aa1c688f880f0519e3de18bf3bae89abf8", "Event selector to filter for")
	caseInsensitive  = flag.Bool("case-insensitive", true, "Whether to do case-insensitive comparison for the selector")
	partialMatch     = flag.Bool("partial-match", true, "Whether to allow partial matches for the selector")
	envFile          = flag.String("env-file", ".env", "Path to the .env file")
	batchSize        = flag.Int("batch-size", 30, "Number of blocks to process in each batch")
	
	// Default Starknet configuration
	defaultStarknetConfig = StarknetConfig{
		NodeURL:     "https://starknet-sepolia.blastapi.io/de586456-fa13-4575-9e6c-b73f9a88bc97/rpc/v0_7",  // Using Blast API as default
		NetworkName: "sepolia",
	}

	// Default event filter using the new EventEmittedFilter structure
	defaultEventFilter = StarknetEventFilter{
		ContractAddress: "0x4726e48f50c7bfcb4eb7d89790fdf2718911207f3e8d90ada0caf36c4ff2c23",
		FromBlock:      "latest",  // Start from latest block by default
		// Filter for EventEmitted events with the specific selector
		Keys:          [][]string{},
		ChunkSize:     100,  // Default chunk size
	}

	// Default EventEmitted filter specifically for EventEmitted events
	defaultEventEmittedFilter = EventEmittedFilter{
		ContractAddress: "0x4726e48f50c7bfcb4eb7d89790fdf2718911207f3e8d90ada0caf36c4ff2c23",
		Keys:          [][]string{}, // Empty keys array to get all events
		FromBlock:      "latest", // Will be updated based on command line flags
		ChunkSize:      100,
	}
)

func init() {
	// Parse command line flags
	flag.Parse()
	
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
	
	var err error
	dockerClient, err = client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		log.Fatalf("Failed to create Docker client: %v", err)
	}

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

// Add this function to enforce the delay between container startups
func enforceContainerStartDelay() {
	containerStartMutex.Lock()
	defer containerStartMutex.Unlock()
	
	// Calculate time since last container start
	timeSinceLastStart := time.Since(lastContainerStartTime)
	
	// If less than 60 seconds have passed, wait for the remaining time
	if timeSinceLastStart < 60*time.Second {
		waitTime := 60*time.Second - timeSinceLastStart
		log.Infof("Enforcing 60s delay between container startups. Waiting for %v...", waitTime)
		time.Sleep(waitTime)
	}
	
	// Update the last container start time
	lastContainerStartTime = time.Now()
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

	// Enforce the delay between container startups
	enforceContainerStartDelay()

	// Create a more deterministic container name
	// Format: dreams-emitted-{event_id}-{timestamp}
	// timestamp format: YYYYMMDD-HHMMSS
	timestamp := time.Now().Format("20060102-150405")
	containerName := fmt.Sprintf("dreams-emitted-%s-%s", event.EventID, timestamp)

	// If event.Environment is nil, initialize it
	if event.Environment == nil {
		event.Environment = make(map[string]string)
	}

	// Add the required API keys to the environment map
	// event.Environment["SEED"] = "'$RANDOM_SEED'"
	event.Environment["ANTHROPIC_API_KEY"] = anthropicAPIKey
	event.Environment["OPENAI_API_KEY"] = openaiAPIKey
	event.Environment["OPENROUTER_API_KEY"] = openrouterAPIKey

	// Prepare environment variables
	env := []string{
		fmt.Sprintf("EVENT_ID=%s", event.EventID),
		fmt.Sprintf("EVENT_TYPE=%s", event.EventType),
		fmt.Sprintf("EVENT_SELECTOR=%s", targetSelector),
	}
	
	// Add keys to environment variables - this is what we care about
	for i, key := range keys {
		env = append(env, fmt.Sprintf("EVENT_KEY_%d=%s", i, key))
	}
	
	// Add data/values to environment variables
	for i, val := range data {
		env = append(env, fmt.Sprintf("EVENT_DATA_%d=%s", i, val))
	}
	
	// Add other relevant information
	for k, v := range event.Environment {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}

	// Create container
	resp, err := dockerClient.ContainerCreate(
		context.Background(),
		&container.Config{
			Image: "chairman-app:latest",
			Env:   env,
		},
		&container.HostConfig{
			NetworkMode: "chairman_chairman-network",
			AutoRemove:  false,
		},
		nil,
		nil,
		containerName,
	)
	if err != nil {
		log.Errorf("Failed to create container for EventEmitted event: %v", err)
		return
	}

	// Start container
	if err := dockerClient.ContainerStart(context.Background(), resp.ID, types.ContainerStartOptions{}); err != nil {
		log.Errorf("Failed to start container for EventEmitted event: %v", err)
		return
	}

	status := ContainerStatus{
		ContainerID: resp.ID,
		Status:      "running",
		CreatedAt:   time.Now(),
		EventID:     event.EventID,
	}
	activeContainers[resp.ID] = status

	log.Infof("Container %s started for EventEmitted event %s with keys: %v", containerName, event.EventID, keys)
}

func handleEvent(c *gin.Context) {
	var event EventPayload
	if err := c.BindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If event.Environment is nil, initialize it
	if event.Environment == nil {
		event.Environment = make(map[string]string)
	}

	// Add the required API keys to the environment map
	// event.Environment["SEED"] = "'$RANDOM_SEED'"
	event.Environment["ANTHROPIC_API_KEY"] = anthropicAPIKey
	event.Environment["OPENAI_API_KEY"] = openaiAPIKey
	event.Environment["OPENROUTER_API_KEY"] = openrouterAPIKey

	containerName := fmt.Sprintf("dreams-%s-%s", event.EventID, time.Now().Format("20060102-150405"))

	// Prepare environment variables
	env := []string{
		fmt.Sprintf("EVENT_ID=%s", event.EventID),
		fmt.Sprintf("EVENT_TYPE=%s", event.EventType),
	}
	for k, v := range event.Environment {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}

	// Enforce the delay between container startups
	enforceContainerStartDelay()

	// Create container
	resp, err := dockerClient.ContainerCreate(
		context.Background(),
		&container.Config{
			Image: "chairman-app:latest",
			Env:   env,
		},
		&container.HostConfig{
			NetworkMode:     "chairman_chairman-network",
			AutoRemove:      false,
		},
		nil,
		nil,
		containerName,
	)
	if err != nil {
		log.Errorf("Failed to create container: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Start container
	if err := dockerClient.ContainerStart(context.Background(), resp.ID, types.ContainerStartOptions{}); err != nil {
		log.Errorf("Failed to start container: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	status := ContainerStatus{
		ContainerID: resp.ID,
		Status:      "running",
		CreatedAt:   time.Now(),
		EventID:     event.EventID,
	}
	activeContainers[resp.ID] = status

	log.Infof("Container %s started for event %s", containerName, event.EventID)
	c.JSON(http.StatusOK, status)
}

func getContainerStatus(c *gin.Context) {
	containerID := c.Param("container_id")
	status, exists := activeContainers[containerID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
		return
	}
	c.JSON(http.StatusOK, status)
}

func stopContainer(c *gin.Context) {
	containerID := c.Param("container_id")
	timeoutSeconds := 10
	
	if err := dockerClient.ContainerStop(context.Background(), containerID, container.StopOptions{Timeout: &timeoutSeconds}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	delete(activeContainers, containerID)
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Container %s stopped", containerID),
	})
}

// streamContainerLogs handles WebSocket connections for container logs
func streamContainerLogs(c *gin.Context) {
	containerID := c.Param("container_id")
	
	// Check if container exists
	_, exists := activeContainers[containerID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Container not found"})
		return
	}

	// Set CORS headers
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Origin, Content-Type")

	// Handle preflight requests
	if c.Request.Method == "OPTIONS" {
		c.Status(http.StatusOK)
		return
	}

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade connection: %v", err)
		return
	}
	defer ws.Close()

	// Set read/write deadlines
	ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	ws.SetWriteDeadline(time.Now().Add(10 * time.Second))

	// Get container logs
	ctx := context.Background()
	logs, err := dockerClient.ContainerLogs(ctx, containerID, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100", // Start with last 100 lines
		Timestamps:  true,
	})
	if err != nil {
		log.Errorf("Failed to get container logs: %v", err)
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error: %v", err)))
		return
	}
	defer logs.Close()

	// Create a goroutine to read logs and send them to the WebSocket
	go func() {
		defer ws.Close()
		defer logs.Close()

		// Create a buffer to store the log data
		buf := make([]byte, 32*1024) // 32KB buffer
		for {
			n, err := logs.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Errorf("Error reading logs: %v", err)
				}
				return
			}

			// Send the raw log data as a binary message
			if err := ws.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				log.Errorf("Error writing to WebSocket: %v", err)
				return
			}

			// Reset write deadline after each write
			ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
		}
	}()

	// Keep the connection alive and handle client messages
	for {
		messageType, message, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Errorf("WebSocket error: %v", err)
			}
			break
		}

		// Reset read deadline after each read
		ws.SetReadDeadline(time.Now().Add(60 * time.Second))

		// Echo the message back (can be used for ping/pong or other control messages)
		if err := ws.WriteMessage(messageType, message); err != nil {
			log.Errorf("Error writing to WebSocket: %v", err)
			break
		}
	}
}

// Add this function to get container ID by name
func getContainerIDByName(name string) (string, error) {
	containers, err := dockerClient.ContainerList(context.Background(), types.ContainerListOptions{
		All: true,
	})
	if err != nil {
		return "", fmt.Errorf("failed to list containers: %v", err)
	}

	for _, container := range containers {
		// Check both the container name and any aliases
		for _, containerName := range container.Names {
			// Docker container names start with a slash, so we need to trim it
			containerName = strings.TrimPrefix(containerName, "/")
			if containerName == name {
				return container.ID, nil
			}
		}
	}
	return "", fmt.Errorf("container not found: %s", name)
}

// Add this new endpoint handler
func getContainerByName(c *gin.Context) {
	name := c.Param("name")
	containerID, err := getContainerIDByName(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"container_id": containerID})
}

func main() {
	r := gin.Default()

	r.POST("/event", handleEvent)
	r.GET("/containers/:container_id", getContainerStatus)
	r.DELETE("/containers/:container_id", stopContainer)
	r.GET("/containers/:container_id/logs", streamContainerLogs)
	r.GET("/containers/name/:name", getContainerByName) // Add this new route

	// Display current configuration
	log.Info("Starting Dreams Container Manager...")
	log.Infof("Contract Address: %s", defaultEventEmittedFilter.ContractAddress)
	log.Infof("Event Selector: %s", *eventSelector)
	log.Infof("Case-insensitive matching: %v", *caseInsensitive)
	log.Infof("Partial matching: %v", *partialMatch)
	log.Info("Including both event keys and data in environment variables")
	
	// Display API key status (without revealing the actual keys)
	log.Infof("ANTHROPIC_API_KEY: %s", maskAPIKey(anthropicAPIKey))
	log.Infof("OPENAI_API_KEY: %s", maskAPIKey(openaiAPIKey))
	log.Infof("OPENROUTER_API_KEY: %s", maskAPIKey(openrouterAPIKey))
	
	// Display starting block information
	if fromBlock, ok := defaultEventEmittedFilter.FromBlock.(string); ok && fromBlock == "latest" {
		log.Info("Starting from latest block")
	} else if fromBlockMap, ok := defaultEventEmittedFilter.FromBlock.(map[string]interface{}); ok {
		if blockNum, ok := fromBlockMap["block_number"]; ok {
			log.Infof("Starting from block number: %v", blockNum)
		}
	}
	
	log.Infof("Listening on :8000")
	if err := r.Run(":8000"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// maskAPIKey masks an API key for display in logs
func maskAPIKey(key string) string {
	if key == "" {
		return "not set"
	}
	
	if len(key) <= 8 {
		return "****"
	}
	
	// Show only first 4 and last 4 characters
	return key[:4] + "..." + key[len(key)-4:]
} 