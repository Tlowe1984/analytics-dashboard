# Analytics Dashboard TODO

## Phase 1: Project Setup
- [x] Initialize full-stack web project with database and authentication
- [x] Create todo.md tracking file

## Phase 2: Google Docs Integration
- [x] Access and extract executive summary content from Google Doc
- [x] Parse document structure and identify sections
- [x] Map content to 3x3 grid structure (Highlights/Risks/Upcoming × AI Glasses/Wrist/ARG-SSG)
- [ ] Use sample data for initial dashboard build

## Phase 3: Backend Implementation
- [x] Design database schema for storing dashboard data
- [ ] Implement Google Docs API integration with OAuth
- [x] Create tRPC procedures for fetching and syncing data
- [x] Add data parsing and categorization logic
- [x] Set up real-time data sync mechanism

## Phase 4: Frontend UI Development
- [x] Implement glassmorphism design system (colors, shadows, blur effects)
- [x] Build topline view 3x3 grid layout component
- [x] Create dynamic icon system for highlights/risks/upcoming
- [x] Implement bullet-point content rendering
- [x] Add responsive layout for mobile/tablet/desktop
- [x] Create placeholder sections for future views (Device, Experience, System, Dates, Decisions)

## Phase 5: Testing & Deployment
- [ ] Test Google Docs API integration (deferred - using sample data)
- [x] Verify real-time data sync
- [x] Test responsive layout across devices
- [x] Create and run vitest tests for dashboard operations
- [x] Create checkpoint for deployment

## Layout Improvements
- [x] Restructure ToplineView to group sections by product category
- [x] Create 3 large product tiles instead of 9 separate section tiles
- [x] Each product tile contains all 3 sections (Highlights, Risks/Opens, Upcoming)

## Horizontal Layout Optimization
- [x] Adjust grid to display all 3 product tiles side-by-side horizontally
- [x] Optimize spacing and sizing for horizontal layout
- [x] Ensure responsive behavior on smaller screens

## AI Chat & Devices Section
- [x] Add Gemini-powered Q&A interface at the top of dashboard
- [x] Create compact chat bar that takes minimal screen space
- [x] Implement backend tRPC procedure to query dashboard data with LLM
- [x] Group all three product tiles into a "Devices" section with colored container
- [x] Add "Devices" section header with visual styling

## Layout Fix
- [x] Fix product tiles to display side-by-side on all screen sizes
- [x] Adjust breakpoint or grid configuration for horizontal layout (changed from xl to lg breakpoint)

## Data Population from Google Doc
- [x] Parse executive summary content from downloaded document
- [x] Populate AI Glasses section with highlights, risks, and upcoming items
- [x] Populate Wrist section with highlights, risks, and upcoming items
- [x] Populate ARG/SSG section with highlights, risks, and upcoming items
- [x] Add week number (W5) to dashboard header
- [x] Add red indicators for critical risks marked with 🔴 (emojis preserved in content)

## Upcoming Dates Section
- [x] Access Google Sheets data from Wearable Program Milestones SOT
- [x] Create database schema for milestone dates (PDP gates, SW milestones, HW dates)
- [x] Extract and parse milestone data from spreadsheet
- [x] Build Upcoming Dates UI section with 3 subsections
- [x] Display PDP gates, Key Software Milestones, and Hardware dates

## Text Visibility Fix
- [x] Fix white text color in Upcoming Dates section for better visibility
- [x] Ensure proper contrast between text and background

## Milestone Display Improvements
- [x] Swap program name to be larger/primary text and milestone name to be secondary
- [x] Sort milestones in chronological order (already sorted by database query)
- [x] Add week number for 2026 dates with format "W## (MMM d)"
- [x] Unify date font styling (single line with consistent font)
