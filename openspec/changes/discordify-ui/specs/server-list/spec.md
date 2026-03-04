## ADDED Requirements

### Requirement: Server list displays joined Spaces as servers
The system SHALL display all top-level Matrix Spaces (spaces with no parent space) as server icons in a vertical list on the leftmost column (72px wide). Each server icon SHALL show the Space avatar as a 48px rounded-square image. If no avatar exists, the system SHALL display the first letter of the server name as a fallback.

#### Scenario: User sees their joined servers
- **WHEN** the application loads and sync completes
- **THEN** the server list displays all top-level Spaces the user has joined, ordered by the user's custom sort order (persisted in localStorage)

#### Scenario: Server with no avatar shows initial
- **WHEN** a server has no avatar set
- **THEN** the server icon displays the first character of the server name with a colored background (deterministic color based on server ID hash)

### Requirement: Server icon hover and selection states
The system SHALL change the server icon from a rounded square (border-radius 16px) to a circle (border-radius 50%) on hover with a smooth 150ms transition. The currently selected server SHALL always display as a circle. A white pill indicator (4px wide) SHALL appear on the left edge of the selected server.

#### Scenario: Hovering over unselected server
- **WHEN** user hovers over a server icon that is not selected
- **THEN** the icon animates from rounded-square to circle over 150ms and shows a short pill indicator (8px tall)

#### Scenario: Selected server indicator
- **WHEN** a server is currently selected
- **THEN** the icon displays as a circle with a tall pill indicator (40px tall) on the left edge

### Requirement: Server unread indicators
The system SHALL display unread indicators on server icons. A white dot below the icon indicates unread messages. If there are mentions (@), the system SHALL display a red badge with the mention count overlaid on the bottom-right of the icon.

#### Scenario: Server has unread messages without mentions
- **WHEN** any channel within a server has unread messages but no mentions
- **THEN** a white dot (8px diameter) appears below the server icon

#### Scenario: Server has unread mentions
- **WHEN** any channel within a server has unread @mentions
- **THEN** a red badge with the mention count appears at the bottom-right of the icon

### Requirement: DM entry in server list
The system SHALL display a special "Home" icon at the top of the server list (above all servers) that navigates to the DM view. This icon SHALL use a Discord-style logo or chat bubble icon. A separator line SHALL separate the Home icon from the server list.

#### Scenario: Clicking Home icon
- **WHEN** user clicks the Home icon
- **THEN** the channel sidebar switches to display the DM conversation list
- **AND** the route navigates to `/dm`

### Requirement: Server list drag-to-reorder
The system SHALL allow users to reorder servers by drag-and-drop. The new order SHALL be persisted to localStorage. The Home/DM icon at the top SHALL NOT be draggable.

#### Scenario: User drags server to new position
- **WHEN** user drags a server icon and drops it at a new position
- **THEN** the server list updates to reflect the new order
- **AND** the order is persisted to localStorage

### Requirement: Create server action
The system SHALL display a "+" icon below the server list that opens a dialog for creating a new Space (server). The dialog SHALL allow setting server name and optional avatar.

#### Scenario: Creating a new server
- **WHEN** user clicks the "+" button and fills in the server name
- **THEN** a new Matrix Space is created with the given name
- **AND** the server appears in the server list
- **AND** the user is navigated to the new server
