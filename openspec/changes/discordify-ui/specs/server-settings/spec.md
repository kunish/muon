## ADDED Requirements

### Requirement: Server settings page accessible from server header
The system SHALL provide access to server settings through a dropdown menu triggered by clicking the server name in the channel sidebar header. The dropdown SHALL include: "Server Settings" (admin only), "Create Channel", "Create Category", "Invite People", "Notification Settings", and "Leave Server".

#### Scenario: Admin opening server dropdown
- **WHEN** an admin clicks the server name in the channel sidebar header
- **THEN** a dropdown menu appears with all options including "Server Settings"

#### Scenario: Regular member opening server dropdown
- **WHEN** a regular member clicks the server name
- **THEN** the dropdown shows only: Invite People, Notification Settings, Leave Server

### Requirement: Server settings overview page
The system SHALL display a server settings page with sidebar navigation. The overview section SHALL allow editing: server name, server avatar (upload/remove), and server description/topic. Changes SHALL be saved to the Matrix Space state events.

#### Scenario: Changing server name
- **WHEN** admin edits the server name in settings and saves
- **THEN** the Space's `m.room.name` state event is updated
- **AND** the server name updates in the server list and channel sidebar header

### Requirement: Role management based on Matrix power levels
The system SHALL provide a role management page that maps Matrix power levels to named roles. Default roles: Owner (100), Admin (75), Moderator (50), Member (0). Admins SHALL be able to create custom roles with specific power levels and assign display colors to each role.

#### Scenario: Creating a custom role
- **WHEN** admin creates a new role "VIP" with power level 25 and color #E91E63
- **THEN** the role is saved to the Space's state (using custom state event `im.muon.roles`)
- **AND** members assigned this role appear with the role color in the member panel

#### Scenario: Assigning a role to a member
- **WHEN** admin assigns a role to a member
- **THEN** the member's power level in the Space is updated to match the role's power level
- **AND** the member's display name color updates in real-time

### Requirement: Channel management in server settings
The system SHALL provide a channel management page listing all channels and categories in the server. Admins SHALL be able to: reorder channels within categories (drag-and-drop), move channels between categories, edit channel name/topic, set channel as NSFW, and delete channels.

#### Scenario: Reordering channels
- **WHEN** admin drags a channel to a new position within a category
- **THEN** the Space's child room ordering is updated
- **AND** the channel sidebar reflects the new order

#### Scenario: Deleting a channel
- **WHEN** admin deletes a channel from server settings
- **THEN** a confirmation dialog appears warning about permanent deletion
- **AND** upon confirmation, the room is removed from the Space (not deleted from Matrix, just unlinked)

### Requirement: Member management in server settings
The system SHALL provide a member management page showing all server members with their roles, join dates, and last active time. Admins SHALL be able to: search members, filter by role, change member roles, kick members, and ban members.

#### Scenario: Kicking a member
- **WHEN** admin clicks "Kick" on a member
- **THEN** a confirmation dialog appears with an optional reason field
- **AND** upon confirmation, the member is kicked from all rooms in the Space

#### Scenario: Searching members
- **WHEN** admin types in the member search box
- **THEN** the member list filters in real-time by display name or Matrix user ID

### Requirement: Server invite generation
The system SHALL allow creating invite links for the server. The invite dialog SHALL show the server's Matrix room alias or ID that can be shared. Optionally, the system SHALL support generating time-limited invite tokens (if the homeserver supports it).

#### Scenario: Generating an invite link
- **WHEN** user clicks "Invite People" from the server dropdown
- **THEN** a dialog appears showing a copyable invite link/alias
- **AND** a "Copy" button copies the link to clipboard with a success toast
