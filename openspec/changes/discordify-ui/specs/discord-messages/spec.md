## ADDED Requirements

### Requirement: Compact message layout (non-bubble)
The system SHALL render messages in a compact list layout instead of chat bubbles. Each message group SHALL display: a 40px avatar on the left, username and timestamp on the first line, and message content below. Consecutive messages from the same user within 5 minutes SHALL be grouped — only the first message in a group shows the avatar and username; subsequent messages show only the content with a hover-revealed timestamp on the left.

#### Scenario: First message in a group
- **WHEN** a message is the first from a user (or more than 5 minutes since their last message)
- **THEN** the message renders with: 40px avatar | username (colored by role) + timestamp | message content

#### Scenario: Continuation message in a group
- **WHEN** a message is from the same user within 5 minutes of their previous message
- **THEN** the message renders without avatar or username
- **AND** hovering reveals a compact timestamp (HH:MM format) in the avatar column area

### Requirement: Message hover action bar
The system SHALL display a floating action bar when hovering over a message. The bar SHALL appear at the top-right corner of the message and contain icon buttons for: Add Reaction (emoji face icon), Reply (arrow icon), and More (three dots icon). The More button SHALL open a dropdown menu with: Edit Message (if own message), Pin Message, Delete Message (if own or admin), Copy Text, Copy Message Link.

#### Scenario: Hovering over own message
- **WHEN** user hovers over a message they sent
- **THEN** an action bar appears with Add Reaction, Reply, and More buttons
- **AND** the More dropdown includes Edit Message and Delete Message

#### Scenario: Hovering over another user's message
- **WHEN** user hovers over a message from another user
- **THEN** the action bar appears with Add Reaction, Reply, and More
- **AND** the More dropdown does NOT include Edit Message

### Requirement: New message separator
The system SHALL display a red separator line with the text "NEW" when the user scrolls to messages that arrived while they were away or viewing another channel. The separator SHALL appear above the first unread message.

#### Scenario: Returning to a channel with new messages
- **WHEN** user navigates to a channel that has unread messages
- **THEN** a red line with "NEW" text appears above the first unread message
- **AND** the view scrolls to that separator position

### Requirement: Message reactions display
The system SHALL display emoji reactions below the message content as small pill-shaped buttons. Each pill shows the emoji, a count, and whether the current user has reacted. Clicking a reaction pill toggles the current user's reaction. A "+" button at the end of the reaction row opens the emoji picker to add a new reaction.

#### Scenario: Message with reactions
- **WHEN** a message has emoji reactions
- **THEN** reaction pills appear below the message content
- **AND** each pill shows the emoji and reaction count
- **AND** pills where the current user has reacted are highlighted with a Blurple border

#### Scenario: Adding a reaction via pill
- **WHEN** user clicks on an existing reaction pill they haven't reacted to
- **THEN** the user's reaction is added and the count increments
- **AND** the pill gets the highlighted Blurple border

### Requirement: System messages display
The system SHALL render system events (joins, leaves, name changes, etc.) as centered, muted text with an icon prefix. System messages SHALL NOT display avatars or usernames in the standard message format.

#### Scenario: User join event
- **WHEN** a new member joins the channel
- **THEN** a centered system message displays: "→ Username joined the channel" in muted gray text

### Requirement: Reply message display
The system SHALL display replied-to messages as a compact reference above the reply content. The reference shows a thin vertical line, the original sender's avatar (16px), username, and a truncated preview of the original message (single line, max 150 chars). Clicking the reference SHALL scroll to the original message.

#### Scenario: Message with reply
- **WHEN** a message is a reply to another message
- **THEN** a compact reply reference appears above the message content
- **AND** clicking the reference scrolls to and briefly highlights the original message

### Requirement: Message input area
The system SHALL display a message input area at the bottom of the chat area. The input SHALL show placeholder text "Message #channel-name". Above the input, the system SHALL show a typing indicator when other users are typing. The input SHALL support: text formatting shortcuts, emoji picker (right side button), file attachment (left side "+" button), and multiline input with Shift+Enter.

#### Scenario: Typing a message
- **WHEN** user types in the message input
- **THEN** the input expands vertically as needed (up to 50% of chat area height)
- **AND** the placeholder disappears

#### Scenario: Others typing indicator
- **WHEN** one or more users are typing in the channel
- **THEN** a typing indicator appears above the input showing "{User} is typing..." or "{User1}, {User2} are typing..." with an animated dots indicator
