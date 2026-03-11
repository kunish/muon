## ADDED Requirements

### Requirement: Discord dark color scheme as default

The system SHALL use a Discord-inspired dark color scheme as the default theme. The color scheme SHALL define the following CSS variable mappings in `.dark` (which becomes the default):

- Background (main chat area): `hsl(220, 8%, 25%)` — `#36393f`
- Secondary/Sidebar background: `hsl(220, 7%, 20%)` — `#2f3136`
- Tertiary/Server bar background: `hsl(220, 8%, 14%)` — `#202225`
- Primary brand color (buttons, links, accents): `hsl(235, 86%, 65%)` — `#5865F2` (Blurple)
- Text primary: `hsl(210, 10%, 87%)` — `#dcddde`
- Text muted: `hsl(214, 8%, 61%)` — `#96989d`
- Positive/Online: `hsl(139, 47%, 44%)` — `#3ba55c`
- Warning/Idle: `hsl(38, 96%, 54%)` — `#faa61a`
- Danger/DND: `hsl(0, 84%, 60%)` — `#ed4245`

#### Scenario: Application loads with dark theme

- **WHEN** the application loads for the first time (fresh install)
- **THEN** the dark theme is applied by default
- **AND** all color variables match the Discord-inspired dark scheme

#### Scenario: Color variables apply globally

- **WHEN** the dark theme is active
- **THEN** all UI components (buttons, inputs, dialogs, tooltips, menus) use the Discord color variables through Tailwind utility classes

### Requirement: Light theme alternative

The system SHALL maintain a light theme option accessible through settings. The light theme SHALL use Discord-inspired light colors:

- Background: `hsl(0, 0%, 100%)` — `#ffffff`
- Secondary: `hsl(220, 13%, 95%)` — `#f2f3f5`
- Text primary: `hsl(220, 13%, 18%)` — `#2e3338`
- Primary accent remains Blurple: `#5865F2`

#### Scenario: Switching to light theme

- **WHEN** user selects light theme in settings
- **THEN** all color variables update to the light scheme
- **AND** the preference is persisted to localStorage

### Requirement: Status color indicators

The system SHALL define semantic colors for user presence status: Online (green `#3ba55c`), Idle (yellow `#faa61a`), Do Not Disturb (red `#ed4245`), Offline (gray `#747f8d`). These colors SHALL be available as CSS variables and Tailwind utilities.

#### Scenario: Status colors in member list

- **WHEN** viewing the member panel
- **THEN** each user's presence indicator uses the correct status color

### Requirement: Typography following Discord style

The system SHALL use the following font stack: `'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif`. Heading sizes SHALL follow: server name 16px semibold, channel name 16px medium, category name 12px uppercase semibold, message username 16px medium, message body 14px regular, timestamp 12px regular.

#### Scenario: Font rendering

- **WHEN** the application renders any text
- **THEN** the Discord font stack is used as specified
- **AND** CJK characters render correctly through Noto Sans fallback

### Requirement: Interactive element styling

The system SHALL style interactive elements (buttons, inputs, selects) following Discord conventions: primary buttons use Blurple with white text, secondary buttons use gray-600 background, hover states darken by 5%, focus states show a Blurple ring, disabled states reduce opacity to 50%.

#### Scenario: Primary button states

- **WHEN** a primary button is rendered
- **THEN** it uses Blurple background with white text
- **AND** hover darkens the background
- **AND** focus shows a 2px Blurple outline ring
