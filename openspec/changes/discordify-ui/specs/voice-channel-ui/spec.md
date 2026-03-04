## ADDED Requirements

### Requirement: Voice channel shows connected users inline
The system SHALL display voice channels in the channel sidebar with a speaker icon prefix. Below each voice channel entry, the system SHALL list all currently connected users with their 24px avatar and display name. Each connected user entry SHALL show a microphone-muted icon if the user is muted and a headphone icon if deafened.

#### Scenario: Voice channel with multiple connected users
- **WHEN** 3 users are connected to a voice channel
- **THEN** the channel sidebar shows the voice channel name followed by 3 indented user entries
- **AND** each entry shows the user's avatar, name, and mute/deafen status icons

#### Scenario: Empty voice channel
- **WHEN** no users are connected to a voice channel
- **THEN** only the channel name with speaker icon is shown (no user list below)

### Requirement: Joining a voice channel
The system SHALL connect the user to a voice channel when they click on it. The connection SHALL use the existing LiveKit infrastructure. Upon connection, the user's entry SHALL appear in the voice channel's user list. The system SHALL only allow connection to one voice channel at a time — joining a new voice channel SHALL disconnect from the current one.

#### Scenario: Clicking a voice channel to join
- **WHEN** user clicks on a voice channel
- **THEN** the system connects to the voice channel via LiveKit
- **AND** the user's avatar and name appear in the channel's connected user list
- **AND** the voice status bar appears at the bottom of the channel sidebar

#### Scenario: Switching voice channels
- **WHEN** user clicks a different voice channel while already connected
- **THEN** the system disconnects from the current voice channel
- **AND** connects to the newly clicked voice channel

### Requirement: Voice connection status bar
The system SHALL display a voice connection status bar fixed at the bottom of the channel sidebar when the user is connected to a voice channel. The bar SHALL show: a green "Voice Connected" label with the channel name, a signal strength indicator, and three control buttons: Mute toggle (microphone icon), Deafen toggle (headphone icon), and Disconnect (phone-hangup icon).

#### Scenario: Connected to voice channel
- **WHEN** user is connected to a voice channel
- **THEN** a status bar appears at the bottom of the channel sidebar
- **AND** it displays "Voice Connected" with the channel name in green text
- **AND** three control buttons are visible

#### Scenario: Muting via status bar
- **WHEN** user clicks the microphone button in the voice status bar
- **THEN** the user's microphone is muted/unmuted
- **AND** the microphone icon updates to show muted state (with a slash through it)
- **AND** other users in the voice channel see the user's mute status update

#### Scenario: Disconnecting from voice
- **WHEN** user clicks the disconnect (hangup) button in the voice status bar
- **THEN** the user disconnects from the voice channel
- **AND** the voice status bar disappears
- **AND** the user's entry is removed from the voice channel's connected user list

### Requirement: Voice channel user limit display
The system SHALL display the current and maximum user count for voice channels that have a user limit set (via room state). The format SHALL be "X/Y" next to the channel name, where X is current users and Y is the limit. Channels at capacity SHALL be visually dimmed and show a locked indicator.

#### Scenario: Voice channel approaching limit
- **WHEN** a voice channel has 4/5 users connected
- **THEN** the channel shows "4/5" count next to the name

#### Scenario: Voice channel at capacity
- **WHEN** a voice channel reaches its user limit
- **THEN** the channel name is dimmed
- **AND** a lock icon appears
- **AND** clicking the channel shows a tooltip "Channel is full"
