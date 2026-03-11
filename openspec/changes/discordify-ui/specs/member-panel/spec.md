## ADDED Requirements

### Requirement: Member panel displays channel members by role

The system SHALL display a 240px-wide member panel on the right side of the chat area. Members SHALL be grouped by their highest role (mapped from Matrix power levels). Each role group shows a header with the role name and online member count. Within each group, online members appear first (sorted alphabetically), followed by offline members (dimmed).

#### Scenario: Viewing member panel for a channel

- **WHEN** user has the member panel visible
- **THEN** members are displayed grouped by role (e.g., "ADMIN — 2", "MODERATOR — 3", "MEMBER — 15")
- **AND** each member shows their avatar (32px), display name (colored by role color), and status indicator

#### Scenario: Offline members display

- **WHEN** a member is offline
- **THEN** their entry is shown with reduced opacity (50%) and a gray status indicator
- **AND** they appear after all online members in their role group

### Requirement: Member panel toggle

The system SHALL provide a toggle button in the chat area header to show/hide the member panel. The panel visibility state SHALL be persisted per-channel. Toggling SHALL animate the panel sliding in/out with a 200ms transition.

#### Scenario: Hiding the member panel

- **WHEN** user clicks the member list toggle button in the header
- **THEN** the member panel slides out to the right over 200ms
- **AND** the chat area expands to fill the freed space

### Requirement: User presence status indicators

The system SHALL display a colored status indicator on each member's avatar. Status types: Online (green circle), Idle (yellow half-moon), Do Not Disturb (red circle with dash), Offline (gray outlined circle). The indicator SHALL be 10px, positioned at the bottom-right of the avatar.

#### Scenario: User goes online

- **WHEN** a member's presence changes to online
- **THEN** their avatar's status indicator updates to a solid green circle

#### Scenario: User is idle

- **WHEN** a member has been inactive for the configured idle threshold
- **THEN** their avatar's status indicator shows a yellow half-moon icon

### Requirement: User info popover on member click

The system SHALL display a user info popover when clicking on a member in the member panel. The popover SHALL show: large avatar (80px), display name, username (@user:server), custom status text (if set), role badges, "Message" button to open/create a DM, and account creation date.

#### Scenario: Clicking a member

- **WHEN** user clicks on a member in the member panel
- **THEN** a popover appears showing the member's profile info
- **AND** clicking "Message" navigates to a DM with that user

#### Scenario: Clicking own profile in member list

- **WHEN** user clicks on their own name in the member panel
- **THEN** the popover shows their own profile with an "Edit Profile" button instead of "Message"

### Requirement: Member context menu

The system SHALL display a context menu when right-clicking a member. Options include: "Profile" (opens popover), "Message" (open DM), "Mention" (insert @mention in input). Admin-only options: "Change Nickname", "Mute", "Kick", "Ban".

#### Scenario: Right-clicking a member as admin

- **WHEN** an admin right-clicks on a non-admin member
- **THEN** the context menu shows all options including admin actions (Mute, Kick, Ban)

#### Scenario: Right-clicking a member as regular user

- **WHEN** a regular member right-clicks on another member
- **THEN** the context menu shows only Profile, Message, and Mention
