Okay, let's refine the instructions for the `known_entities_context` and its actions, emphasizing agent control over its content.

---

**Context: `known_entities_context`**

**Description:**
This context serves as your (the AI agent's) curated dossier of other significant entities in the game world (e.g., other players, key NPCs, notable creature camps). You actively manage this list, deciding which entities to track, what information to store about them, and your personal notes or assessments. While the game system provides raw perception data, this context reflects _your_ persistent, strategic knowledge base about other actors.

**Instructions for AI Agent (How to use this context):**

1.  **Curate Your Knowledge:** You are in control of adding, updating, and removing entities from this context using actions like `agent.known_entities.add_or_update` and `agent.known_entities.remove`. Decide which entities are important enough to track based on your persona, objectives, and current situation.
2.  **Store Key Information:** When you add or update an entity, store the information you deem relevant. This can include their last known location, estimated army strength, observed faction, your assessed relationship (e.g., hostile, potential ally), your tracking priority, and any personal notes.
3.  **Personalize with Notes:** Use the `agent.known_entities.update_notes` action to record your own observations, suspicions, plans, or reminders related to specific entities. This is your private intelligence log.
4.  **Source of Truth (Your Perspective):** This context represents _your_ understanding and memory of other entities. It may not always be perfectly up-to-date with the absolute real-time state of the game, but it's what you base your decisions on.
5.  **Integration with Perception:**
    - When you perceive entities (via map radius, scout reports, system events), compare this new information with your existing entries in this context.
    - Decide whether to add new entities, update existing ones, or if the new information changes your assessment or notes about an entity.
6.  **Subscription for Key Targets:** For entities of high interest, even if they are outside your immediate perception, you can use `agent.entities.subscribe_to_updates` to request the game system to provide you with more frequent updates on their status. This complements your curated knowledge.
7.  **Dynamic Management:** Regularly review and manage this list. Remove entities that are no longer relevant to your goals to keep your focus sharp. Adjust tracking priorities as the strategic landscape changes.

---

**Actions for Managing `known_entities_context` (Agent-Driven):**

1.  **`agent.known_entities.add_or_update`**

    - **Purpose:** You (the agent) use this action to consciously add a new entity to your `known_entities_context` or to update the information you are storing about an entity you are already tracking. This action signifies your decision to commit specific information about an entity to your persistent, curated knowledge base.
    - **When to use:**
      - After perceiving a new entity that you deem important enough to track.
      - After gaining new, significant information about an entity you are already tracking (e.g., observed a change in their army, new location, change in behavior).
      - When you want to explicitly record your assessment or change your tracking priority for an entity.

2.  **`agent.known_entities.remove`**

    - **Purpose:** You use this action to deliberately remove an entity from your `known_entities_context`. This means you are choosing to no longer actively track or maintain a detailed record of this entity in your primary dossier.
    - **When to use:**
      - When an entity is confirmed destroyed or has permanently left the relevant game area.
      - When an entity is deemed no longer strategically relevant to your current goals or persona.
      - To manage the size and focus of your actively tracked entities list.

3.  **`agent.known_entities.update_notes`**
    - **Purpose:** You use this action to add, modify, or clear your personal `notes` field for a specific entity within your `known_entities_context`. These notes are your private annotations, observations, suspicions, or reminders.
    - **When to use:**
      - After an interaction or observation that gives you a new insight or thought about an entity.
      - To remind yourself of past behaviors, agreements, or planned future interactions related to an entity.
      - To summarize your strategic assessment of an entity.

**Complementary System-Interaction Actions (Agent-Initiated):**

4.  **`agent.entities.subscribe_to_updates`**

    - **Purpose:** You use this action to request the game system to provide you with more proactive and potentially more frequent updates about a specific `entity_id`, even if that entity is outside your normal perception range. This is useful for keeping tabs on critical allies, major threats, or entities central to your long-term plans.
    - **Note:** The system will then feed updates (which you can process and decide to commit via `agent.known_entities.add_or_update`).

5.  **`agent.entities.unsubscribe_from_updates`**
    - **Purpose:** You use this action to inform the game system that you no longer require special, proactive updates for a specific `entity_id`. You might still track them via your own perceptions and `known_entities_context` entries, but you're opting out of the enhanced system-pushed updates.

---

This framework should give the AI agent much more granular control and make the `known_entities_context` a more dynamic and personalized tool for strategic decision-making. How does this revised set of instructions and action descriptions align with your vision?
