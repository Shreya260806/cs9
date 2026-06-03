# LeftPane

Sidebar navigation panel for the student dashboard. Collapsible — when expanded `w-64`, when collapsed `w-16` showing only icons. The collapse/expand control sits at the **top** of the panel.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isCollapsed` | `boolean` | ✅ | Whether the sidebar is in collapsed mode |
| `onToggleCollapse` | `function` | ✅ | Toggles `isCollapsed` state |
| `sidebarNav` | `string` | ✅ | Current sidebar nav label (matches `NAV_ITEMS` keys) |
| `currentView` | `string` | ✅ | Active view name — `'dashboard'` activates nav |
| `onNavigate` | `function` | ✅ | Callback with nav label to switch views |

## States

| State | Width | Visible |
|-------|-------|---------|
| Expanded | `w-64` (256px) | Brand + "Internship Hub" subtitle (left) and collapse toggle (right) + "Student portal" label + nav labels |
| Collapsed | `w-16` (64px) | Collapse/expand toggle (centered) + nav icons only — brand text hidden |

## Nav Items

| Label | Icon | Behaviour |
|-------|------|-----------|
| `Dashboard` | `LayoutGrid` | Sets sidebar nav + switches to dashboard |
| `My Queries` | `MessageSquare` | Sets sidebar nav (view switch handled by parent) |

## Active State Styling

Active nav item (both `sidebarNav` matches AND `currentView === 'dashboard'`):
- `border-r-2 border-[#8c6a40]`
- `bg-[#8c6a40]/10`
- `font-semibold text-[#8c6a40]`

Hover state (inactive):
- `hover:bg-[#8c6a40]/10 hover:text-[#8c6a40]`

Inactive default: `text-[#444748]`

## Visual Elements

- Vertical connector line between nav items (dotted `bg-[#d9dadb]`)
- Header row at top: brand ("Rogāre" + "Internship Hub" subtitle) on the left, collapse/expand toggle on the right. When collapsed, the brand is hidden and the toggle is centered as the only header element.
- Collapse/expand toggle: `Menu` (hamburger) icon at the top of the panel; calls `onToggleCollapse`
- Section label: "Student portal" (hidden when collapsed)
- Background: `#f8f9fa` (light gray, distinct from content area)

## Notes

- Clicking the brand logo navigates to `'Dashboard'`
- Width transitions with `transition-all duration-300`
- Collapse state is owned by `UserLayout`, not `LeftPane`
- The vertical connector line uses `absolute` positioning from the nav container
- The collapse/expand toggle lives at the top of the panel (moved from a bottom-pinned button in #53, for discoverability across student pages)
