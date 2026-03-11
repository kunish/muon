## ADDED Requirements

### Requirement: Four-column layout structure

The system SHALL render the main application layout as four columns from left to right: Server List (72px fixed) | Channel Sidebar (240px fixed) | Chat Area (flex grow) | Member Panel (240px, collapsible). The entire layout SHALL fill the viewport height (`100vh`) with no page scrolling.

#### Scenario: Default layout rendering

- **WHEN** user is logged in and viewing a server channel
- **THEN** all four columns are visible with correct widths
- **AND** the chat area fills the remaining horizontal space

#### Scenario: Member panel collapsed

- **WHEN** user toggles the member panel off
- **THEN** the member panel is hidden and the chat area expands to fill the freed space

### Requirement: Chat area header

The system SHALL display a header bar at the top of the chat area containing: a hash icon and channel name (for text channels), the channel topic (truncated with tooltip), and action buttons on the right (pinned messages, member list toggle, search, inbox, help). For DM conversations, the header SHALL show the other user's avatar and name.

#### Scenario: Text channel header

- **WHEN** viewing a text channel
- **THEN** the header shows `# channel-name` with the topic text and action buttons

#### Scenario: DM conversation header

- **WHEN** viewing a DM conversation
- **THEN** the header shows the other user's avatar, display name, and online status indicator

### Requirement: Route-based navigation

The system SHALL use Vue Router for navigation with the following route patterns:

- `/server/:serverId/channel/:channelId` for server channels
- `/dm/:roomId` for DM conversations
- `/dm` for the DM list view
  The system SHALL persist the last visited channel per server so that selecting a server restores the user's last position.

#### Scenario: Navigating to a server

- **WHEN** user clicks a server icon
- **THEN** the route updates to the last visited channel in that server
- **AND** the channel sidebar and chat area update accordingly

#### Scenario: Deep linking to a channel

- **WHEN** the application loads with a URL like `/server/!abc:matrix.org/channel/!def:matrix.org`
- **THEN** the server list highlights the correct server, the channel sidebar scrolls to and highlights the correct channel, and the chat area loads the channel's messages

### Requirement: Responsive chat area with pinned elements

The system SHALL keep the message input area pinned to the bottom of the chat area. The message list SHALL scroll independently. A "new messages" jump button SHALL appear when the user scrolls up and new messages arrive below the viewport.

#### Scenario: New messages while scrolled up

- **WHEN** user has scrolled up in the message list and a new message arrives
- **THEN** a floating button appears at the bottom of the message list showing "New messages — click to jump"
- **AND** clicking the button scrolls to the latest message
