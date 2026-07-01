Admin UI Architecture Rules

Before adding or changing any admin UI pattern, search for an existing shared admin primitive first.

Shared primitives must be used for:
- action menus
- context menus
- right-click menus
- long-press menus
- submenus
- popovers
- filter menus
- topbar buttons
- add buttons
- form sheets
- toasts
- confirmation UI
- status pills
- lace/color dots
- upload controls
- list rows/cards

Do not create page-specific CSS or JS for these patterns unless there is a real technical reason.

Preferred shared naming:
- .admin-action-menu
- .admin-popover
- .admin-filter-menu
- .admin-topbar-btn
- .admin-form-sheet
- .admin-status-pill
- .admin-color-dot

Page-specific code should only provide:
- labels
- menu items
- data
- API action calls
- render content inside shared shells