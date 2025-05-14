import { Logger, LogLevel } from "@daydreamsai/core";
import { io, Socket } from "socket.io-client";
import { z } from "zod";

// Define message data interface
export interface MessageData {
  content: string;
  recipientId?: string;
  roomId?: string;
  sendBy?: string;
  conversationId?: string;
}

// Define message schema for validation
export const messageSchema = z.object({
  content: z.string().describe("The content of the message"),
  recipientId: z
    .string()
    .optional()
    .describe("The recipient ID for direct messages"),
  roomId: z.string().optional().describe("The room ID for room messages"),
  sendBy: z.string().optional().describe("The user ID of the sender."),
  conversationId: z
    .string()
    .optional()
    .describe("The conversation ID (if applicable)"),
});

export type ChatMessage<Data = { content: string }> = {
  userId: string;
  userName: string;
  platformId: "chat";
  threadId: string;
  directMessage: boolean;
  contentId: string;
  data: Data;
};

export function isGlobalMsg(
  msg: ChatMessage<any>
): msg is ChatMessage<{ content: string }> {
  return msg.threadId === "global";
}

interface ChatEvents {
  [event: string]: (...args: any[]) => void;
}

class ChatClient {
  public socket: Socket;
  private logger: Logger;
  private username: string;

  constructor(
    token: string,
    username: string,
    logLevel: LogLevel = LogLevel.INFO
  ) {
    // http://host.docker.internal:3000
    //agent-chat-production-35e4.up.railway.app
    this.socket = io("https://agent-chat-production-35e4.up.railway.app", {
      auth: { token, username },
      transports: ["websocket"],
      timeout: 10000,
    });

    this.username = username;
    this.logger = new Logger({
      level: logLevel,
    });

    this.setupListeners();

    // Log connection status
    this.socket.on("connect", () => {
      this.logger.info("ChatClient", "Connected to server");
    });

    this.socket.on("connect_error", (error) => {
      this.logger.error("ChatClient", "Connection error", { error });
    });

    this.socket.on("disconnect", (reason) => {
      this.logger.info("ChatClient", `Disconnected: ${reason}`);
    });
  }

  private setupListeners() {
    this.socket.on("initialData", (data) => {
      // this.logger.debug("ChatClient", `initaldata`, data);
      // Update UI handled by message stream
    });

    this.socket.on("roomJoined", (data) => {
      this.logger.debug("ChatClient", `roomJoined`, data);
    });

    this.socket.on("directMessage", (data) => {
      this.logger.debug("ChatClient", `DM`, data);
      // Update UI handled by message stream
    });

    this.socket.on("roomMessage", ({ senderId, roomId, message }) => {
      this.logger.debug(
        "ChatClient",
        `Room message from ${senderId} in ${roomId}`,
        { message }
      );
      // Update UI handled by message stream
    });

    this.socket.on("globalMessage", ({ senderId, message }) => {
      this.logger.debug("ChatClient", `Global message from ${senderId}`, {
        message,
      });
      // Update UI handled by message stream
    });
  }

  /**
   * Start listening to chat messages.
   * The onData callback can be used to update UI or process messages.
   */
  public startMessageStream(onData: <T>(data: ChatMessage<T>) => void) {
    this.logger.info("ChatClient", "Starting message stream...");

    // Direct messages
    this.socket.on("directMessage", (data) => {
      console.log("directMessage", data);
      const { senderId, message, senderUsername } = data;
      if (senderUsername === this.username) {
        this.logger.debug(
          "ChatClient",
          `Skipping own message from ${this.username}`
        );
        return;
      }

      onData({
        userId: senderId,
        platformId: "chat",
        userName: senderUsername,
        threadId: senderId, // Use sender ID as thread ID for DMs
        directMessage: true,
        contentId: Date.now().toString(), // Generate a unique ID
        data: {
          content: message,
        },
      });
    });

    // Room messages
    this.socket.on("roomMessage", (data) => {
      const { senderId, message, senderUsername, roomId } = data;

      console.log("roomMessage", data);
      if (senderUsername === this.username) {
        this.logger.debug(
          "ChatClient",
          `Skipping own message from ${this.username}`
        );
        return;
      }

      onData({
        userId: senderId,
        userName: senderUsername,
        platformId: "chat",
        threadId: roomId,
        directMessage: false,
        contentId: Date.now().toString(),
        data: {
          content: message,
          roomId: roomId,
        },
      });
    });

    // Global messages
    this.socket.on("globalMessage", (data) => {
      const { senderId, message, senderUsername } = data;
      if (senderUsername === this.username) {
        this.logger.debug(
          "ChatClient",
          `Skipping own message from ${this.username}`
        );
        return;
      }

      onData({
        userId: senderId,
        platformId: "chat",
        userName: senderUsername,
        threadId: "global",
        directMessage: false,
        contentId: Date.now().toString(),
        data: {
          content: message,
          roomId: "global",
        },
      });
    });
  }

  /**
   * Stop listening to chat messages
   */
  public stopMessageStream() {
    this.socket.off("directMessage");
    this.socket.off("roomMessage");
    this.socket.off("globalMessage");
    this.logger.info("ChatClient", "Message stream stopped");
  }

  /**
   * Destroy the chat client connection
   */
  public destroy() {
    this.stopMessageStream();
    this.socket.disconnect();
    this.logger.info("ChatClient", "Client destroyed");
  }

  /**
   * Send a direct message to a specific recipient
   */
  async sendDirectMessage(
    recipientId: string,
    message: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    content?: string;
    error?: string;
  }> {
    try {
      this.logger.info(
        "ChatClient.sendDirectMessage",
        "Sending direct message",
        {
          recipientId,
          messageLength: message.length,
        }
      );

      if (!recipientId || !message) {
        return {
          success: false,
          error: "Recipient ID and message content are required",
        };
      }

      const MAX_LENGTH = 4000; // Set a reasonable limit

      // Handle message size limits
      if (message.length > MAX_LENGTH) {
        this.logger.warn(
          "ChatClient.sendDirectMessage",
          "Message exceeds maximum length, splitting"
        );

        // Split message into chunks
        const chunks = [];
        for (let i = 0; i < message.length; i += MAX_LENGTH) {
          chunks.push(message.substring(i, i + MAX_LENGTH));
        }

        // Send each chunk
        for (const chunk of chunks) {
          this.socket.emit("directMessage", { recipientId, message: chunk });
        }
      } else {
        this.socket.emit("directMessage", { recipientId, message });
      }

      return {
        success: true,
        content: message,
        messageId: Date.now().toString(), // Generate a unique ID
      };
    } catch (error) {
      this.logger.error(
        "ChatClient.sendDirectMessage",
        "Error sending message",
        { error }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      this.logger.info("ChatClient.joinRoom", "Joining room", { roomId });

      if (!roomId) {
        return {
          success: false,
          error: "Room ID is required",
        };
      }

      this.socket.emit("joinRoom", { roomId });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error("ChatClient.joinRoom", "Error joining room", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a message to a room
   */
  async sendRoomMessage(
    roomId: string,
    message: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    content?: string;
    error?: string;
  }> {
    try {
      this.logger.info("ChatClient.sendRoomMessage", "Sending room message", {
        roomId,
        messageLength: message.length,
      });

      if (!roomId || !message) {
        return {
          success: false,
          error: "Room ID and message content are required",
        };
      }

      const MAX_LENGTH = 4000; // Set a reasonable limit

      // Handle message size limits
      if (message.length > MAX_LENGTH) {
        this.logger.warn(
          "ChatClient.sendRoomMessage",
          "Message exceeds maximum length, splitting"
        );

        // Split message into chunks
        const chunks = [];
        for (let i = 0; i < message.length; i += MAX_LENGTH) {
          chunks.push(message.substring(i, i + MAX_LENGTH));
        }

        // Send each chunk
        for (const chunk of chunks) {
          this.socket.emit("roomMessage", { roomId, message: chunk });
        }
      } else {
        this.socket.emit("roomMessage", { roomId, message });
      }

      return {
        success: true,
        content: message,
        messageId: Date.now().toString(), // Generate a unique ID
      };
    } catch (error) {
      this.logger.error("ChatClient.sendRoomMessage", "Error sending message", {
        error,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a global message
   */
  async sendGlobalMessage(message: string): Promise<{
    success: boolean;
    messageId?: string;
    content?: string;
    error?: string;
  }> {
    try {
      this.logger.info(
        "ChatClient.sendGlobalMessage",
        "Sending global message",
        {
          messageLength: message.length,
        }
      );

      if (!message) {
        return {
          success: false,
          error: "Message content is required",
        };
      }

      const MAX_LENGTH = 4000; // Set a reasonable limit

      // Handle message size limits
      if (message.length > MAX_LENGTH) {
        this.logger.warn(
          "ChatClient.sendGlobalMessage",
          "Message exceeds maximum length, splitting"
        );

        // Split message into chunks
        const chunks = [];
        for (let i = 0; i < message.length; i += MAX_LENGTH) {
          chunks.push(message.substring(i, i + MAX_LENGTH));
        }

        // Send each chunk
        for (const chunk of chunks) {
          this.socket.emit("globalMessage", { message: chunk });
        }
      } else {
        this.socket.emit("globalMessage", { message });
      }

      return {
        success: true,
        content: message,
        messageId: Date.now().toString(), // Generate a unique ID
      };
    } catch (error) {
      this.logger.error(
        "ChatClient.sendGlobalMessage",
        "Error sending message",
        { error }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a message using the provided message data
   */
  async sendMessage(data: MessageData): Promise<{
    success: boolean;
    messageId?: string;
    content?: string;
    error?: string;
  }> {
    try {
      this.logger.info("ChatClient.sendMessage", "Sending message", { data });

      // Validate message data
      const validationResult = messageSchema.safeParse(data);
      if (!validationResult.success) {
        return {
          success: false,
          error:
            "Invalid message data: " +
            JSON.stringify(validationResult.error.errors),
        };
      }

      // Determine message type and send accordingly
      if (data.recipientId) {
        return this.sendDirectMessage(data.recipientId, data.content);
      } else if (data.roomId) {
        return this.sendRoomMessage(data.roomId, data.content);
      } else {
        return this.sendGlobalMessage(data.content);
      }
    } catch (error) {
      this.logger.error("ChatClient.sendMessage", "Error sending message", {
        error,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default ChatClient;
