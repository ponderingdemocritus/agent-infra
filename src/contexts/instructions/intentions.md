1.  **Intention Creation (Part of Decision Phase):**

    - When your analysis (P-A-D-A cycle) suggests a potential goal or action, create a new intention object.
    - Assign it a unique `intention_id`, a clear `description`, an initial `priority`, and relevant `target_info`.
    - Set its initial `status` to `"PROPOSED"`.
    - Crucially, fill in `conditions_or_notes` with any prerequisites, checks, or reasoning that needs to be satisfied before this intention can be acted upon (e.g., "Wait for stamina > 70," "Proceed if area is clear of threats," "Confirm resource availability").
    - Add this new intention object to the list in this context's state.

2.  **Intention Review & Update (Part of Decision Phase):**

    - Regularly review all intentions in this context, especially those with `"PROPOSED"` or `"CONFIRMED"` status.
    - For `"PROPOSED"` intentions:
      - Evaluate if their `conditions_or_notes` are now met based on your current perception of the game state.
      - If conditions are met and you decide to proceed soon, change `status` to `"CONFIRMED"`.
      - If conditions are met and you are starting immediately, change `status` to `"ACTIVE"`.
      - If the intention is no longer relevant, becomes impossible, or conditions are unlikely to be met, change `status` to `"CANCELLED"` or `"FAILED"`.
    - For `"CONFIRMED"` intentions:
      - If you are ready to begin execution, change `status` to `"ACTIVE"`.
      - If circumstances change making it less ideal, you might revert to `"PROPOSED"` with updated notes, or to `"CANCELLED"`.

3.  **Acting on Intentions (Part of Action Phase):**

    - When an intention's `status` is `"ACTIVE"`, execute the necessary game actions (e.g., `action.player.move`, `action.player.attack_entity`) to fulfill it.
    - Your persona and current situation will influence _how_ you execute the active intention.

4.  **Resolving Intentions:**

    - Once the actions for an `"ACTIVE"` intention are completed successfully, change its `status` to `"COMPLETED"`.
    - If the actions fail or the goal cannot be achieved, change its `status` to `"FAILED"`.
    - Periodically, you can clear out old `"COMPLETED"`, `"CANCELLED"`, or `"FAILED"` intentions to keep the list manageable, or they might be archived by a separate process.

5.  **Reactivity:**
    - If a high-priority game event occurs (e.g., you are attacked), your P-A-D-A loop might lead you to:
      - Change the `status` of current low-priority active/confirmed intentions to `"PAUSED"` (you'd need to add "PAUSED" to the status list if we want this).
      - Create a new, high-priority reactive intention (e.g., "Defend against attacker").
      - Cancel existing intentions that conflict with the new urgent situation.
