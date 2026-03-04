## ADDED Requirements

### Requirement: Channel sidebar displays server channels in categories
The system SHALL display a 240px-wide channel sidebar to the right of the server list. The sidebar header SHALL show the server name with a dropdown chevron. Below the header, channels SHALL be organized into collapsible categories (mapped from child Spaces). Channels not belonging to any category SHALL appear under an implicit "Uncategorized" group at the top.

#### Scenario: Viewing a server's channels
- **WHEN** user selects a server from the server list
- **THEN** the channel sidebar displays all rooms within that Space, organized by category
- **AND** each category shows its name in uppercase text with a collapse/expand chevron

#### Scenario: Uncategorized channels
- **WHEN** a server contains rooms that are not in any child Space (category)
- **THEN** those channels appear at the top of the sidebar without a category header

### Requirement: Text channel display
The system SHALL display text channels with a `#` hash prefix icon followed by the channel name. The currently selected channel SHALL have a highlighted background. Channels with unread messages SHALL display the channel name in bold white text. Channels with mentions SHALL show a red mention count badge on the right.

#### Scenario: Selecting a text channel
- **WHEN** user clicks on a text channel
- **THEN** the channel is highlighted with an accent background color
- **AND** the chat area loads the channel's messages
- **AND** the route updates to `/server/:serverId/channel/:channelId`

#### Scenario: Channel with unread messages
- **WHEN** a channel has unread messages
- **THEN** the channel name displays in bold with white/bright text color (instead of muted gray)

### Requirement: Voice channel display
The system SHALL display voice channels with a speaker/volume icon prefix. Below each voice channel, the system SHALL list avatars and names of users currently connected to that voice channel. Voice channels SHALL NOT navigate to a chat view when clicked; instead they SHALL initiate a voice connection.

#### Scenario: Voice channel with connected users
- **WHEN** a voice channel has users connected
- **THEN** the channel shows each connected user's avatar (24px) and display name below the channel name, indented

#### Scenario: Clicking a voice channel
- **WHEN** user clicks on a voice channel
- **THEN** the system initiates a voice connection to that channel via LiveKit
- **AND** the user's avatar appears in the voice channel's connected user list

### Requirement: Category collapse and expand
The system SHALL allow users to collapse and expand channel categories by clicking the category header. Collapsed state SHALL be persisted per-server in the serverStore. The category header SHALL show a rotatable chevron icon indicating collapse state.

#### Scenario: Collapsing a category
- **WHEN** user clicks on a category header that is expanded
- **THEN** the channels under that category are hidden
- **AND** the chevron rotates to point right (from down)
- **AND** the collapsed state is saved in serverStore

### Requirement: Channel context menu
The system SHALL display a context menu when right-clicking on a channel. The menu SHALL include options based on the user's permissions: "Mark as Read", "Mute Channel", "Edit Channel" (if admin), "Delete Channel" (if admin), "Copy Channel Link".

#### Scenario: Right-clicking a text channel as admin
- **WHEN** an admin user right-clicks a text channel
- **THEN** a context menu appears with: Mark as Read, Mute Channel, Edit Channel, Delete Channel, Copy Channel Link

#### Scenario: Right-clicking a channel as regular member
- **WHEN** a regular member right-clicks a text channel
- **THEN** a context menu appears with only: Mark as Read, Mute Channel, Copy Channel Link

### Requirement: Channel sidebar shows DM list when Home is selected
The system SHALL switch the channel sidebar to display a DM conversation list when the Home/DM entry is selected in the server list. The DM sidebar SHALL show a search bar at the top, followed by a "Friends" navigation item, and then a list of recent DM conversations sorted by last message time.

#### Scenario: Switching to DM view
- **WHEN** user clicks the Home icon in the server list
- **THEN** the channel sidebar header changes to show "Direct Messages"
- **AND** the sidebar content shows the DM conversation list with search bar
- **AND** each DM item shows the user's avatar, name, and last message preview

### Requirement: Create channel action
The system SHALL display a "+" icon next to each category header (visible on hover) for creating a new channel within that category. Clicking it SHALL open a dialog to create a new room (text or voice) within the parent Space.

#### Scenario: Creating a new text channel
- **WHEN** user hovers over a category header and clicks the "+" icon
- **THEN** a dialog appears allowing the user to enter a channel name, select type (text/voice), and optionally set as private
- **AND** upon confirmation, a new Matrix room is created and added to the Space
