# src/map_editor.py
import pygame, json, os
from src.map_object import WallLine, MapObject, testWall, Exit, NPC, Stairs, BuildingOutline
from src.simulation import Simulation

class MapEditor:
    def __init__(self, screen, project_path=None):
       
        self.screen = screen
        self.project_path = project_path  # Path to current project file

        # === Multi-building: canvas (site) vs building (floor) editing ===
        # buildings: list of {"outline": BuildingOutline, "layers": [[obj,...], ...]}
        self.buildings = []
        self.editor_mode = "canvas"   # "canvas" = draw/select buildings; "building" = edit floors of selected building
        self.selected_building_index = None  # which building is selected (canvas) or being edited (building)
        self.canvas_tool = "square"   # "square" | "polygon"
        self.polygon_points = []      # current points while drawing a polygon
        self.selected_outline_index = None   # which building outline is selected on canvas
        self.editing_building_name = False   # when True, key events edit the selected building's name

        # Layered environment support (when in building mode, this is the current building's layers)
        self.layers = [[]]  # list of object lists, one per layer
        self.active_layer = 0
        self.objects = self.layers[self.active_layer]
        self.exits = []
        self.current_type = "wall"
        self.dragging = False
        self.start_pos = None
        self.font = pygame.font.Font(None, 24)
        self.selected_index = None
        self.dragging_node = None
        self.node_size = 6
        self.dragging_border = None
        self.selected_wall = None
        self.selected_npc = None  # Track selected NPC for parameter editing
        self.selected_stairs = None  # Track selected stairs for label editing
        self.available_stairs_buttons = []  # Clickable buttons for available stairs

        # === New Grid View Controls ===
        self.cell_size = 10          # grid cell size in pixels (world units)
        self.grid_width = 80         # number of cells horizontally (limited area)
        self.grid_height = 60        # number of cells vertically (limited area)
        self.zoom = 1.0              # zoom factor
        self.offset_x = 0            # panning offset X
        self.offset_y = 0            # panning offset Y
        # Panning behavior: hold 'p' to pan; click-drag while held
        self.pan_held = False
        self.panning = False
        self.pan_start = None

        # Grid appearance
        self.grid_color = (0, 50, 50)
        self.bg_color = (25, 25, 25)
        
        # UI Sidebar for NPC parameter editing
        self.sidebar_width = 280
        self.sidebar_visible = False  # Show sidebar when in NPC mode or NPC selected
        self.speed_slider_x = 0
        self.speed_slider_y = 0
        self.speed_slider_width = 220
        self.speed_slider_height = 25
        self.speed_slider_dragging = False
        self.sidebar_font_large = pygame.font.Font(None, 32)
        self.sidebar_font_medium = pygame.font.Font(None, 24)
        self.sidebar_font_small = pygame.font.Font(None, 20)
        
        # Layer control UI (screen-space buttons)
        self.layer_button_rects = {}
        self.layer_button_size = (28, 26)
        
    # ---- Coordinate transforms (world pixels <-> screen) ----
    def worldpx_to_screen(self, x, y):
        sx = x * self.zoom + self.offset_x
        sy = y * self.zoom + self.offset_y
        return int(sx), int(sy)

    def screen_to_worldpx(self, sx, sy):
        x = (sx - self.offset_x) / self.zoom
        y = (sy - self.offset_y) / self.zoom
        return x, y

    # ---- Grid helpers ----
    def screen_to_grid(self, sx, sy):
        wx, wy = self.screen_to_worldpx(sx, sy)
        gx = int(wx // self.cell_size)
        gy = int(wy // self.cell_size)
        gx = max(0, min(self.grid_width - 1, gx))
        gy = max(0, min(self.grid_height - 1, gy))
        return gx, gy

    def grid_to_worldpx(self, gx, gy):
        return gx * self.cell_size, gy * self.cell_size
    
    # def draw_grid(self):
    #     self.screen.fill(self.bg_color)

    #     # Compute how many lines are visible on screen
    #     w, h = self.screen.get_size()
    #     cell = self.cell_size * self.zoom
    #     start_x = -self.offset_x % cell
    #     start_y = -self.offset_y % cell

    #     for x in range(int(start_x), w, int(cell)):
    #         pygame.draw.line(self.screen, self.grid_color, (x, 0), (x, h), 1)
    #     for y in range(int(start_y), h, int(cell)):
    #         pygame.draw.line(self.screen, self.grid_color, (0, y), (w, y), 1)

    def draw_grid(self, screen):
        """Draw a limited-area grid of size grid_width x grid_height cells."""
        # vertical lines
        for x in range(self.grid_width + 1):
            sx1, sy1 = self.worldpx_to_screen(x * self.cell_size, 0)
            sx2, sy2 = self.worldpx_to_screen(x * self.cell_size, self.grid_height * self.cell_size)
            pygame.draw.line(screen, self.grid_color, (sx1, sy1), (sx2, sy2))
        # horizontal lines
        for y in range(self.grid_height + 1):
            sx1, sy1 = self.worldpx_to_screen(0, y * self.cell_size)
            sx2, sy2 = self.worldpx_to_screen(self.grid_width * self.cell_size, y * self.cell_size)
            pygame.draw.line(screen, self.grid_color, (sx1, sy1), (sx2, sy2))

    def snap_screen_to_grid_worldpx(self, sx, sy):
        """Snap a screen pixel position to nearest grid intersection in world pixels (cell corners)."""
        wx, wy = self.screen_to_worldpx(sx, sy)
        gx = round(wx / self.cell_size)
        gy = round(wy / self.cell_size)
        gx = max(0, min(self.grid_width, gx))
        gy = max(0, min(self.grid_height, gy))
        return self.grid_to_worldpx(gx, gy)

    def snap_screen_to_cell_center_worldpx(self, sx, sy):
        """Snap a screen pixel position to the center of the nearest cell in world pixels."""
        wx, wy = self.screen_to_worldpx(sx, sy)
        gx = int(wx // self.cell_size)
        gy = int(wy // self.cell_size)
        gx = max(0, min(self.grid_width - 1, gx))
        gy = max(0, min(self.grid_height - 1, gy))
        cx = (gx + 0.5) * self.cell_size
        cy = (gy + 0.5) * self.cell_size
        return cx, cy

    def get_nodes(self, obj):
        if hasattr(obj, "type") and obj.type == "line":
            return [(obj.x1, obj.y1), (obj.x2, obj.y2)]
        else:
            x, y, w, h = obj.x, obj.y, obj.w, obj.h
            return [
                (x, y),
                (x + w, y),
                (x + w, y + h),
                (x, y + h)
            ]
        
    def update_borders(self, restore_all=False):
        """Update the wall's border Rects. 
        If restore_all=True, recreate all four borders."""
        t = self.border_thickness
        x, y, w, h = self.x, self.y, self.w, self.h

        all_borders = {
            "top": pygame.Rect(x, y, w, t),
            "bottom": pygame.Rect(x, y + h - t, w, t),
            "left": pygame.Rect(x, y, t, h),
            "right": pygame.Rect(x + w - t, y, t, h)
        }

        if restore_all or not hasattr(self, "borders"):
            # recreate all borders
            self.borders = all_borders
        else:
            # only update positions of existing ones
            for key in list(self.borders.keys()):
                self.borders[key] = all_borders[key]
    
    def rasterize_walls_to_grid(self, cell_size=10, grid_width=800, grid_height=600, objects=None):
        """Convert all wall segments into a logical grid representation sized to editor grid."""
        cell_size = self.cell_size
        grid_width = self.grid_width
        grid_height = self.grid_height
        grid = [[0 for _ in range(grid_width)] for _ in range(grid_height)]
        objects = objects if objects is not None else self.objects

        def bresenham(x1, y1, x2, y2):
            """Yield all grid points a line passes through."""
            dx = abs(x2 - x1)
            dy = abs(y2 - y1)
            x, y = x1, y1
            sx = 1 if x2 > x1 else -1
            sy = 1 if y2 > y1 else -1
            if dx > dy:
                err = dx / 2.0
                while x != x2:
                    yield x, y
                    err -= dy
                    if err < 0:
                        y += sy
                        err += dx
                    x += sx
            else:
                err = dy / 2.0
                while y != y2:
                    yield x, y
                    err -= dx
                    if err < 0:
                        x += sx
                        err += dy
                    y += sy
            yield x, y

        for obj in objects:
            if isinstance(obj, testWall):
                for border_segments in obj.borders.values():
                    for (p1, p2) in border_segments:
                        x1 = int(p1[0] // cell_size)
                        y1 = int(p1[1] // cell_size)
                        x2 = int(p2[0] // cell_size)
                        y2 = int(p2[1] // cell_size)

                        for gx, gy in bresenham(x1, y1, x2, y2):
                            if 0 <= gx < grid_width and 0 <= gy < grid_height:
                                grid[gy][gx] = 1
            elif isinstance(obj, WallLine):
                x1 = int(obj.x1 // cell_size)
                y1 = int(obj.y1 // cell_size)
                x2 = int(obj.x2 // cell_size)
                y2 = int(obj.y2 // cell_size)
                for gx, gy in bresenham(x1, y1, x2, y2):
                    if 0 <= gx < grid_width and 0 <= gy < grid_height:
                        grid[gy][gx] = 1

        return grid

    # ---- Floor (layer) helpers ----
    def _set_active_layer(self, idx):
        idx = max(0, min(idx, len(self.layers) - 1))
        self.active_layer = idx
        self.objects = self.layers[self.active_layer]
        # Clear selections when switching layers
        self.selected_index = None
        self.selected_npc = None
        self.selected_wall = None
        self.selected_stairs = None
        self.dragging = False
        self.dragging_node = None
        self.dragging_border = None
        print(f"📄 Switched to floor {self.active_layer + 1}/{len(self.layers)}")

    def add_layer(self):
        self.layers.append([])
        self._set_active_layer(len(self.layers) - 1)
        print(f"➕ Added floor {self.active_layer + 1}")

    def remove_layer(self):
        if len(self.layers) <= 1:
            print("⚠️ Cannot remove the last floor.")
            return
        self.layers.pop(self.active_layer)
        new_index = min(self.active_layer, len(self.layers) - 1)
        self._set_active_layer(new_index)
        print(f"➖ Removed floor. Now {len(self.layers)} floor(s).")

    def next_layer(self):
        self._set_active_layer((self.active_layer + 1) % len(self.layers))

    def prev_layer(self):
        self._set_active_layer((self.active_layer - 1) % len(self.layers))

    def _handle_layer_button_click(self, pos):
        """Return True if a layer control button was clicked."""
        for name, rect in self.layer_button_rects.items():
            if rect.collidepoint(*pos):
                if name == "add":
                    self.add_layer()
                elif name == "remove":
                    self.remove_layer()
                elif name == "prev":
                    self.prev_layer()
                elif name == "next":
                    self.next_layer()
                return True
        return False

    # ---- Multi-building: canvas <-> building mode ----
    def _sync_layers_to_building(self):
        """Push current self.layers into the selected building (call before leaving building mode)."""
        if self.editor_mode != "building" or self.selected_building_index is None:
            return
        if 0 <= self.selected_building_index < len(self.buildings):
            self.buildings[self.selected_building_index]["layers"] = [list(l) for l in self.layers]

    def _sync_layers_from_building(self):
        """Load current building's layers into self.layers (call when entering building mode)."""
        if self.selected_building_index is None or not (0 <= self.selected_building_index < len(self.buildings)):
            self.layers = [[]]
            self._set_active_layer(0)
            return
        b = self.buildings[self.selected_building_index]
        self.layers = [list(l) for l in b.get("layers", [[]])]
        if not self.layers:
            self.layers = [[]]
        self._set_active_layer(0)
        self.objects = self.layers[self.active_layer]

    def _enter_canvas_mode(self):
        """Switch to site canvas; save current building's layers first."""
        self._sync_layers_to_building()
        self.editor_mode = "canvas"
        self.selected_building_index = None
        self.selected_outline_index = None
        self.polygon_points = []
        print("📐 Canvas mode: draw or select a building to edit floors.")

    def _enter_building_mode(self, building_index):
        """Switch to editing the given building's floors."""
        if not (0 <= building_index < len(self.buildings)):
            return
        self._sync_layers_to_building()  # save previous building if any
        self.selected_building_index = building_index
        self.selected_outline_index = building_index
        self._sync_layers_from_building()
        self.editor_mode = "building"
        print(f"🏢 Editing building {building_index + 1} ({len(self.layers)} floor(s)). Press B to back to site.")

    def _point_inside_current_building(self, wx, wy):
        """Return True if (wx, wy) is inside the current building outline, or if we're not in building mode."""
        if self.editor_mode != "building" or self.selected_building_index is None or not self.buildings:
            return True
        if self.selected_building_index >= len(self.buildings):
            return True
        outline = self.buildings[self.selected_building_index]["outline"]
        return outline.contains_point(wx, wy)

    def _rect_inside_current_building(self, x, y, w, h):
        """Return True if all four corners of the rect are inside the current building outline."""
        if not self.buildings or self.editor_mode != "building" or self.selected_building_index is None:
            return True
        corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        return all(self._point_inside_current_building(cx, cy) for cx, cy in corners)

    def _get_current_building_outline_screen_points(self):
        """Return list of (sx, sy) screen points for the current building outline (for drawing overlay)."""
        if self.selected_building_index is None or self.selected_building_index >= len(self.buildings):
            return []
        outline = self.buildings[self.selected_building_index]["outline"]
        if outline.shape == "rect":
            pts = [
                (outline.x, outline.y),
                (outline.x + outline.w, outline.y),
                (outline.x + outline.w, outline.y + outline.h),
                (outline.x, outline.y + outline.h),
            ]
        else:
            pts = list(outline.points) if outline.points else []
        return [self.worldpx_to_screen(px, py) for px, py in pts]

    def _next_building_name(self):
        """Return a unique default name for a new building."""
        used = {b.get("name", "") for b in self.buildings}
        for i in range(1, len(self.buildings) + 50):
            name = f"Building {i}"
            if name not in used:
                return name
        return f"Building {len(self.buildings) + 1}"

    def _add_building(self, outline):
        """Add a new building with one empty floor and a default name."""
        name = self._next_building_name()
        self.buildings.append({"name": name, "outline": outline, "layers": [[]]})
        print(f"➕ {name} added. Select it and press Enter to edit floors.")

    def _handle_canvas_button_click(self, mx, my):
        """Return True if a canvas toolbar button was clicked."""
        for name, rect in getattr(self, "canvas_button_rects", {}).items():
            if rect.collidepoint(mx, my):
                if name == "square":
                    self.canvas_tool = "square"
                    self.polygon_points = []
                elif name == "polygon":
                    self.canvas_tool = "polygon"
                elif name == "edit_building" and self.selected_outline_index is not None:
                    self._enter_building_mode(self.selected_outline_index)
                return True
        return False

    
    def handle_event(self, event):
        # ---- Canvas mode: site-level drawing and building selection ----
        if self.editor_mode == "canvas":
            if event.type == pygame.KEYDOWN:
                # Name editing: when editing selected building's name, keys modify name
                if self.editing_building_name and self.selected_outline_index is not None and self.selected_outline_index < len(self.buildings):
                    b = self.buildings[self.selected_outline_index]
                    name = b.get("name", "")
                    if event.key == pygame.K_RETURN or event.key == pygame.K_KP_ENTER:
                        self.editing_building_name = False
                        return
                    elif event.key == pygame.K_ESCAPE:
                        self.editing_building_name = False
                        return
                    elif event.key == pygame.K_BACKSPACE:
                        b["name"] = name[:-1]
                        return
                    elif event.unicode and event.unicode.isprintable():
                        b["name"] = name + event.unicode
                        return
                if event.key == pygame.K_p:
                    self.pan_held = True
                elif event.key == pygame.K_F2 and self.selected_outline_index is not None:
                    self.editing_building_name = True
                    return
                elif event.key == pygame.K_1:
                    self.canvas_tool = "square"
                    self.polygon_points = []
                    self.editing_building_name = False
                    print("📐 Tool: Square (drag to draw building outline)")
                elif event.key == pygame.K_2:
                    self.canvas_tool = "polygon"
                    self.editing_building_name = False
                    print("📐 Tool: Polygon (click points, then Enter or right-click to close)")
                elif event.key == pygame.K_RETURN or event.key == pygame.K_KP_ENTER:
                    if self.canvas_tool == "polygon" and len(self.polygon_points) >= 3:
                        outline = BuildingOutline(shape="polygon", points=self.polygon_points)
                        self._add_building(outline)
                        self.polygon_points = []
                    elif self.selected_outline_index is not None:
                        self._enter_building_mode(self.selected_outline_index)
                    return
                elif event.key == pygame.K_DELETE:
                    if not self.editing_building_name and self.selected_outline_index is not None and self.buildings:
                        self.buildings.pop(self.selected_outline_index)
                        self.selected_outline_index = None
                        print("🗑 Building removed.")
                    return
                elif event.key == pygame.K_BACKSPACE and not self.editing_building_name:
                    if self.selected_outline_index is not None and self.buildings:
                        self.buildings.pop(self.selected_outline_index)
                        self.selected_outline_index = None
                        print("🗑 Building removed.")
                    return
                elif event.key == pygame.K_s:
                    self.save_map()
                elif event.key == pygame.K_o:
                    self.load_map()
            elif event.type == pygame.KEYUP and event.key == pygame.K_p:
                self.pan_held = False
                self.panning = False
                self.pan_start = None
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and not self.pan_held:
                mx, my = event.pos
                if self._handle_canvas_button_click(mx, my):
                    return
                wx, wy = self.screen_to_worldpx(mx, my)
                # Click on name field to start editing?
                if getattr(self, "building_name_rect", None) and self.building_name_rect.collidepoint(mx, my):
                    self.editing_building_name = True
                    return
                # Always allow selecting a building by clicking on it (any tool)
                for i in range(len(self.buildings) - 1, -1, -1):
                    if self.buildings[i]["outline"].contains_point(wx, wy):
                        self.selected_outline_index = i
                        self.editing_building_name = False
                        self.dragging = False
                        bname = self.buildings[i].get("name", "Building")
                        print(f"🏢 Selected '{bname}'. Enter=edit floors, F2=rename.")
                        return
                # Click not on a building
                self.selected_outline_index = None
                self.editing_building_name = False
                if self.canvas_tool == "square":
                    self.start_pos = (wx, wy)
                    self.dragging = True
                elif self.canvas_tool == "polygon":
                    self.polygon_points.append((wx, wy))
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 3:
                if self.canvas_tool == "polygon" and len(self.polygon_points) >= 3:
                    outline = BuildingOutline(shape="polygon", points=self.polygon_points)
                    self._add_building(outline)
                    self.polygon_points = []
                return
            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if self.dragging and self.canvas_tool == "square" and self.start_pos:
                    wx, wy = self.screen_to_worldpx(*event.pos)
                    x1, y1 = self.start_pos
                    x2, y2 = wx, wy
                    x, y = min(x1, x2), min(y1, y2)
                    w, h = abs(x2 - x1), abs(y2 - y1)
                    if w > 10 and h > 10:
                        outline = BuildingOutline(shape="rect", x=x, y=y, w=w, h=h)
                        self._add_building(outline)
                    self.dragging = False
            elif event.type == pygame.MOUSEBUTTONDOWN and (event.button == 4 or event.button == 5) and not self.pan_held:
                mx, my = event.pos
                wx = (mx - self.offset_x) / self.zoom
                wy = (my - self.offset_y) / self.zoom
                if event.button == 4:
                    self.zoom = min(self.zoom * 1.1, 3.0)
                else:
                    self.zoom = max(self.zoom / 1.1, 0.5)
                self.offset_x = mx - wx * self.zoom
                self.offset_y = my - wy * self.zoom
            elif event.type == pygame.MOUSEWHEEL and not self.pan_held:
                if event.y > 0:
                    mx, my = pygame.mouse.get_pos()
                    wx = (mx - self.offset_x) / self.zoom
                    wy = (my - self.offset_y) / self.zoom
                    self.zoom = min(self.zoom * 1.1, 3.0)
                    self.offset_x = mx - wx * self.zoom
                    self.offset_y = my - wy * self.zoom
                elif event.y < 0:
                    mx, my = pygame.mouse.get_pos()
                    wx = (mx - self.offset_x) / self.zoom
                    wy = (my - self.offset_y) / self.zoom
                    self.zoom = max(self.zoom / 1.1, 0.5)
                    self.offset_x = mx - wx * self.zoom
                    self.offset_y = my - wy * self.zoom
            # Panning and scroll zoom (button 4/5) handled below for both modes
            if self.editor_mode == "canvas":
                if event.type == pygame.MOUSEMOTION and self.panning and self.pan_start:
                    mx, my = pygame.mouse.get_pos()
                    dx, dy = mx - self.pan_start[0], my - self.pan_start[1]
                    self.offset_x += dx
                    self.offset_y += dy
                    self.pan_start = (mx, my)
                if event.type == pygame.MOUSEBUTTONDOWN and self.pan_held and event.button == 1:
                    self.panning = True
                    self.pan_start = pygame.mouse.get_pos()
                if event.type == pygame.MOUSEBUTTONUP and event.button == 1 and self.panning:
                    self.panning = False
                    self.pan_start = None
                return  # Don't run building-mode event handling
            # (fall-through only if we just switched to building mode this frame - we don't, we return above)

        # ---- Building mode: floor editing (original behavior) ----
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_b and self.editor_mode == "building":
                self._enter_canvas_mode()
                return
            if event.key == pygame.K_p:
                # Hold-to-pan
                self.pan_held = True
            elif event.key == pygame.K_w:
                self.current_type = "wall"
                self.selected_npc = None  # Clear NPC selection when switching modes
            elif event.key == pygame.K_n:
                self.current_type = "npc"
            elif event.key == pygame.K_e:
                self.current_type = "exit"
                self.selected_npc = None  # Clear NPC selection when switching modes
            elif event.key == pygame.K_t:
                self.current_type = "stairs"
                self.selected_npc = None  # Clear NPC selection when switching modes
            elif event.key == pygame.K_l:
                self.current_type = "line"
                self.selected_npc = None  # Clear NPC selection when switching modes
            elif event.key == pygame.K_s:
                self.save_map()  # save_map now handles both environment and grid
            elif event.key == pygame.K_o:
                self.load_map()
            elif event.key == pygame.K_r and self.selected_wall:
                self.selected_wall.update_borders(restore_all=True)
                print("🔁 Restored all borders for selected wall.")
            elif event.key == pygame.K_PAGEUP:
                self.next_layer()
            elif event.key == pygame.K_PAGEDOWN:
                self.prev_layer()
            # Inline editing for selected stairs (name or connects_to)
            elif self.selected_stairs:
                # Ensure stairs has name and connects_to attributes
                if not hasattr(self.selected_stairs, 'name'):
                    # Backwards compatibility: generate name from connection_id or link_id
                    old_id = getattr(self.selected_stairs, 'connection_id', None) or getattr(self.selected_stairs, 'link_id', None)
                    self.selected_stairs.name = f"Stair{old_id}" if old_id else f"Stair{Stairs._name_counter}"
                    Stairs._name_counter += 1
                if not hasattr(self.selected_stairs, 'connects_to'):
                    self.selected_stairs.connects_to = ""
                
                # Determine which field to edit based on mode
                # We'll use a flag to track if we're editing name or connects_to
                # For now, default to editing connects_to (can be changed with Tab key)
                editing_field = getattr(self, '_editing_stairs_field', 'connects_to')  # 'name' or 'connects_to'
                
                if event.key == pygame.K_TAB:
                    # Switch between editing name and connects_to
                    self._editing_stairs_field = 'name' if editing_field == 'connects_to' else 'connects_to'
                    return
                elif event.key == pygame.K_BACKSPACE:
                    if editing_field == 'name':
                        if len(self.selected_stairs.name) > 0:
                            self.selected_stairs.name = self.selected_stairs.name[:-1]
                    else:  # connects_to
                        if len(self.selected_stairs.connects_to) > 0:
                            self.selected_stairs.connects_to = self.selected_stairs.connects_to[:-1]
                elif event.key == pygame.K_RETURN or event.key == pygame.K_KP_ENTER:
                    # Finish editing
                    self._editing_stairs_field = None
                else:
                    ch = event.unicode
                    if ch and ch.isprintable():
                        if editing_field == 'name':
                            self.selected_stairs.name += ch
                        else:  # connects_to
                            self.selected_stairs.connects_to += ch
        elif event.type == pygame.KEYUP:
            if event.key == pygame.K_p:
                self.pan_held = False
                self.panning = False
                self.pan_start = None
        elif event.type == pygame.MOUSEMOTION:
            # Handle panning (priority)
            if self.panning and self.pan_start:
                mx, my = pygame.mouse.get_pos()
                dx, dy = mx - self.pan_start[0], my - self.pan_start[1]
                self.offset_x += dx
                self.offset_y += dy
                self.pan_start = (mx, my)
                return  # Don't process other mouse motion when panning
            
            # Handle speed slider dragging
            if self.speed_slider_dragging and self.selected_npc:
                mx, my = event.pos
                screen_width = self.screen.get_width()
                # Calculate slider position (same as in draw_sidebar)
                sidebar_x = screen_width - self.sidebar_width
                slider_start_x = sidebar_x + 30
                slider_end_x = slider_start_x + self.speed_slider_width
                
                # Clamp mouse x to slider range
                mouse_x = max(slider_start_x, min(mx, slider_end_x))
                
                # Calculate speed value (0.5 to 5.0)
                speed_min, speed_max = 0.5, 5.0
                ratio = (mouse_x - slider_start_x) / self.speed_slider_width
                new_speed = speed_min + ratio * (speed_max - speed_min)
                self.selected_npc.speed = new_speed
                return
            
            # Handle wall border dragging
            if self.dragging_border and self.selected_wall:
                # Drag borders using raw world coordinates (no snapping)
                mx, my = self.screen_to_worldpx(*event.pos)
                wall = self.selected_wall

                # Move the selected wall border
                if self.dragging_border == "left":
                    new_x = mx
                    new_w = (wall.x + wall.w) - new_x
                    if new_w > 5:
                        wall.x = new_x
                        wall.w = new_w

                elif self.dragging_border == "right":
                    new_w = mx - wall.x
                    if new_w > 5:
                        wall.w = new_w

                elif self.dragging_border == "top":
                    new_y = my
                    new_h = (wall.y + wall.h) - new_y
                    if new_h > 5:
                        wall.y = new_y
                        wall.h = new_h

                elif self.dragging_border == "bottom":
                    new_h = my - wall.y
                    if new_h > 5:
                        wall.h = new_h

                # Update geometry to reflect new shape
                wall.update_border_geometry()
                return
        elif event.type == pygame.MOUSEBUTTONDOWN:
            # Mouse wheel zoom support (centered on cursor)
            if event.button == 4:  # Scroll up
                mx, my = event.pos
                wx = (mx - self.offset_x) / self.zoom
                wy = (my - self.offset_y) / self.zoom
                self.zoom = min(self.zoom * 1.1, 3.0)  # Limit max zoom
                self.offset_x = mx - wx * self.zoom
                self.offset_y = my - wy * self.zoom
            elif event.button == 5:  # Scroll down
                mx, my = event.pos
                wx = (mx - self.offset_x) / self.zoom
                wy = (my - self.offset_y) / self.zoom
                self.zoom = max(self.zoom / 1.1, 0.5)  # Limit min zoom
                self.offset_x = mx - wx * self.zoom
                self.offset_y = my - wy * self.zoom

            # Right-click delete still allowed regardless of pan mode
            if event.button == 3:
                # convert to world px for hit testing
                mx_screen, my_screen = pygame.mouse.get_pos()
                mx, my = self.screen_to_worldpx(mx_screen, my_screen)
                for obj in self.objects:
                    if obj.type == "wall":
                        if obj.delete_border_at_point(mx, my):
                            self.save_map()
                            break
                return

            # If holding pan: left click starts panning instead of drawing/selecting
            if self.pan_held and event.button == 1:
                # Check if clicking in sidebar - don't pan if clicking in sidebar
                mx_screen, my_screen = event.pos
                screen_width = self.screen.get_width()
                sidebar_should_be_visible = (self.current_type == "npc" or self.selected_npc is not None)
                
                if sidebar_should_be_visible and mx_screen > screen_width - self.sidebar_width:
                    # Don't start panning if clicking in sidebar area
                    return
                
                # Start panning
                self.panning = True
                self.pan_start = pygame.mouse.get_pos()
                return

            if event.button == 1 and not self.pan_held:  # left click (drawing when not panning)
                # First, check UI layer buttons (screen-space)
                if self._handle_layer_button_click(event.pos):
                    return

                mx_screen, my_screen = event.pos
                
                # Check if clicking on sidebar (right side of screen)
                # Determine if sidebar should be visible based on current state
                sidebar_should_be_visible = (self.current_type == "npc" or self.selected_npc is not None or 
                                            self.current_type == "stairs" or self.selected_stairs is not None)
                screen_width = self.screen.get_width()
                
                if sidebar_should_be_visible and mx_screen > screen_width - self.sidebar_width:
                    # Check if clicking on speed slider (NPC sidebar)
                    if self.selected_npc:
                        slider_rect = pygame.Rect(
                            self.speed_slider_x,
                            self.speed_slider_y,
                            self.speed_slider_width,
                            self.speed_slider_height
                        )
                        if slider_rect.collidepoint(mx_screen, my_screen):
                            self.speed_slider_dragging = True
                            return
                    
                    # Check if clicking on stairs sidebar buttons
                    if self.selected_stairs:
                        # Check if clicking on available stairs buttons
                        if hasattr(self, 'available_stairs_buttons'):
                            for button_rect, stairs_name in self.available_stairs_buttons:
                                if button_rect.collidepoint(mx_screen, my_screen):
                                    # Set this stairs as the connection target
                                    self.selected_stairs.connects_to = stairs_name
                                    print(f"🪜 Connected '{self.selected_stairs.name}' → '{stairs_name}'")
                                    return
                        # No other buttons needed - just edit name/connects_to by typing
                        pass
                    
                    # Don't process map clicks when clicking in sidebar area
                    return
                
                # convert to world px for all hit-testing (only if not in sidebar)
                mx, my = self.screen_to_worldpx(mx_screen, my_screen)

                # Check if clicking on NPC object for selection
                npc_clicked = False
                for obj in self.objects:
                    if isinstance(obj, NPC):
                        if (obj.x <= mx <= obj.x + obj.w and 
                            obj.y <= my <= obj.y + obj.h):
                            self.selected_npc = obj
                            self.selected_index = self.objects.index(obj)
                            npc_clicked = True
                            self.dragging = False  # Don't start drawing
                            print(f"👤 Selected NPC: speed={obj.speed}")
                            return  # Stop here, don't process further
                    if isinstance(obj, Stairs):
                        if (obj.x <= mx <= obj.x + obj.w and
                            obj.y <= my <= obj.y + obj.h):
                            self.selected_stairs = obj
                            self.selected_index = self.objects.index(obj)
                            npc_clicked = True
                            self.dragging = False
                            stairs_name = getattr(obj, 'name', None) or '?'
                            connects_to = getattr(obj, 'connects_to', None) or '(none)'
                            print(f"🪜 Selected stairs '{stairs_name}' → '{connects_to}'")
                            return
                
                # If clicking outside sidebar and not on NPC/Stairs, deselect them
                # Check sidebar visibility based on current state
                sidebar_should_be_visible = (self.current_type == "npc" or self.selected_npc is not None or 
                                            self.current_type == "stairs" or self.selected_stairs is not None)
                if not npc_clicked and (not sidebar_should_be_visible or mx_screen <= screen_width - self.sidebar_width):
                    self.selected_npc = None
                    self.selected_stairs = None

                # Border-click detection
                for obj in self.objects:
                    if isinstance(obj, testWall):
                        for border_name, rect in obj.get_border_rects():
                            if rect.collidepoint(mx, my):
                                self.selected_wall = obj
                                self.dragging_border = border_name
                                self.selected_npc = None
                                print(f"🧱 Selected border: {border_name}")
                                return

                # Check if clicked on a node (for resizing)
                for i, obj in enumerate(self.objects):
                    nodes = self.get_nodes(obj)
                    for ni, node in enumerate(nodes):
                        node_rect = pygame.Rect(
                            node[0] - self.node_size,
                            node[1] - self.node_size,
                            self.node_size * 2,
                            self.node_size * 2
                        )
                        if node_rect.collidepoint(mx, my):
                            self.selected_index = i
                            self.dragging_node = ni
                            self.selected_npc = None
                            return  # stop here to avoid creating new shape

                # Otherwise, start drawing at raw world coordinates (no snapping)
                start_world = self.screen_to_worldpx(mx_screen, my_screen)
                # In building mode, only allow starting a draw inside the building outline
                if self.editor_mode == "building" and not self._point_inside_current_building(start_world[0], start_world[1]):
                    print("⚠️ Draw inside the building outline.")
                    return
                self.start_pos = start_world
                self.dragging = True
                self.selected_index = None
                self.dragging_node = None
                self.selected_npc = None


        # ---- Mouse released ----
        elif event.type == pygame.MOUSEBUTTONUP:
            if event.button == 1:
                # Stop panning if it was active
                if self.panning:
                    self.panning = False
                    self.pan_start = None
                
                # Stop slider dragging
                self.speed_slider_dragging = False
                
                # Stop border dragging
                self.dragging_border = None
                self.selected_wall = None

            if self.dragging_node is not None:
                self.dragging_node = None

            elif self.dragging and not self.pan_held:
                # End at raw world coordinates (no snapping)
                end_world = self.screen_to_worldpx(*event.pos)
                x1, y1 = self.start_pos
                x2, y2 = end_world
                rect = pygame.Rect(min(x1, x2), min(y1, y2), abs(x2 - x1), abs(y2 - y1))

                # In building mode, only allow placement inside the building outline
                allow_place = True
                if self.current_type == "line":
                    if not (self._point_inside_current_building(x1, y1) and self._point_inside_current_building(x2, y2)):
                        print("⚠️ Place inside the building outline.")
                        allow_place = False
                else:
                    if not self._rect_inside_current_building(rect.x, rect.y, rect.width, rect.height):
                        print("⚠️ Place inside the building outline.")
                        allow_place = False

                if allow_place:
                    # ✅ Create the appropriate object (snapped)
                    if self.current_type == "wall":
                        new_wall = testWall(rect.x, rect.y, rect.width, rect.height)
                        self.objects.append(new_wall)
                    elif self.current_type == "exit":
                        self.objects.append(Exit(rect.x, rect.y, rect.width, rect.height))
                    elif self.current_type == "stairs":
                        new_stairs = Stairs(rect.x, rect.y, rect.width, rect.height)
                        self.objects.append(new_stairs)
                        self.selected_stairs = new_stairs
                        print(f"🪜 Created stairs '{new_stairs.name}' on layer {self.active_layer + 1}")
                    elif self.current_type == "line":
                        self.objects.append(WallLine(x1, y1, x2, y2))
                    elif self.current_type == "npc":
                        new_npc = NPC(rect.x, rect.y, rect.width, rect.height)
                        self.objects.append(new_npc)
                        self.selected_npc = new_npc
                        self.selected_index = len(self.objects) - 1
                        print(f"👤 Created and selected NPC: speed={new_npc.speed}")
                    else:
                        self.objects.append(MapObject(rect.x, rect.y, rect.width, rect.height, self.current_type))

                self.dragging = False

            # ✅ NOW: Check for wall intersections and split them
            for wall in self.objects:
                if isinstance(wall, testWall):
                    wall.find_and_split_intersections(
                        [obj for obj in self.objects if isinstance(obj, testWall)]
                    )

            print("✅ Updated wall nodes after placement")
        
        # Handle window resize events
        elif event.type == pygame.VIDEORESIZE:
            # Update screen surface to new size
            # Note: pygame doesn't automatically resize, but we can handle it
            pass  # Screen resizing is handled by pygame automatically with RESIZABLE flag
    
    def draw(self, screen):
        screen.fill(self.bg_color)  # Fill the background
        self.draw_grid(screen)

        if self.editor_mode == "canvas":
            # ---- Canvas: draw building outlines (as selectable objects) and names ----
            for i, b in enumerate(self.buildings):
                outline = b["outline"]
                outline.draw(screen, self.offset_x, self.offset_y, self.zoom,
                             selected=(i == self.selected_outline_index))
                # Draw building name at center of outline
                name = b.get("name", f"Building {i+1}")
                x, y, w, h = outline.get_bounds()
                cx = x + w / 2
                cy = y + h / 2
                sx, sy = self.worldpx_to_screen(cx, cy)
                name_surf = self.font.render(name, True, (220, 220, 255))
                nr = name_surf.get_rect(center=(sx, sy))
                # Slight background so text is readable
                pygame.draw.rect(screen, (30, 30, 40), nr.inflate(8, 4), border_radius=2)
                screen.blit(name_surf, nr)
            # Current polygon in progress
            if self.canvas_tool == "polygon" and self.polygon_points:
                pts = [self.worldpx_to_screen(p[0], p[1]) for p in self.polygon_points]
                if len(pts) >= 2:
                    pygame.draw.lines(screen, (150, 220, 255), False, pts, 2)
                for p in pts:
                    pygame.draw.circle(screen, (255, 255, 255), p, 4)
            # Square preview while dragging
            if self.canvas_tool == "square" and self.dragging and self.start_pos:
                mx, my = pygame.mouse.get_pos()
                wx, wy = self.screen_to_worldpx(mx, my)
                x1, y1 = self.start_pos
                x, y = min(x1, wx), min(y1, wy)
                w, h = abs(wx - x1), abs(wy - y1)
                sx = int(x * self.zoom + self.offset_x)
                sy = int(y * self.zoom + self.offset_y)
                sw = max(1, int(w * self.zoom))
                sh = max(1, int(h * self.zoom))
                pygame.draw.rect(screen, (100, 180, 255), pygame.Rect(sx, sy, sw, sh), 2)
            self._draw_canvas_toolbar(screen)
            self._draw_canvas_building_properties(screen)
            label = self.font.render(
                f"Site canvas | 1=Square 2=Polygon | Select building + Enter to edit floors | F2=Rename | Del=Delete | S=Save O=Load | P=Pan",
                True, (255, 255, 255)
            )
            self.screen.blit(label, (10, 10))
            return

        # ---- Building mode: draw floors (original behavior) ----
        # Draw filled blocked cells to cover the center of each grid square
        grid = self.rasterize_walls_to_grid()
        cell_px = int(self.cell_size * self.zoom)
        occupied_color = (80, 80, 80)
        for gy, row in enumerate(grid):
            for gx, val in enumerate(row):
                if val:
                    wx = gx * self.cell_size
                    wy = gy * self.cell_size
                    sx, sy = self.worldpx_to_screen(wx, wy)
                    pygame.draw.rect(self.screen, occupied_color, pygame.Rect(sx, sy, cell_px, cell_px))

        # Transparent overlay: dim area outside the current building outline
        if self.editor_mode == "building" and self.buildings and self.selected_building_index is not None and self.selected_building_index < len(self.buildings):
            pts = self._get_current_building_outline_screen_points()
            if len(pts) >= 3:
                sw, sh = screen.get_width(), screen.get_height()
                overlay = pygame.Surface((sw, sh), pygame.SRCALPHA)
                overlay.fill((20, 20, 25, 160))  # Dark semi-transparent outside
                # Punch a hole for the building interior (draw polygon with transparent)
                pygame.draw.polygon(overlay, (0, 0, 0, 0), pts)
                screen.blit(overlay, (0, 0))
                # Draw building outline border so the boundary is clear
                pygame.draw.polygon(screen, (100, 180, 255), pts, 2)
                pygame.draw.polygon(screen, (180, 220, 255), pts, 1)

        for i, obj in enumerate(self.objects):
            obj.draw(self.screen, self.offset_x, self.offset_y, self.zoom)

            # Highlight selected object
            if i == self.selected_index:
                for node in self.get_nodes(obj):
                    sx, sy = self.worldpx_to_screen(node[0], node[1])
                    pygame.draw.circle(self.screen, (255, 0, 0), (sx, sy), self.node_size)
            
            # Highlight selected NPC with a colored border
            if isinstance(obj, NPC) and obj == self.selected_npc:
                sx = int(obj.x * self.zoom + self.offset_x)
                sy = int(obj.y * self.zoom + self.offset_y)
                sw = max(1, int(obj.w * self.zoom))
                sh = max(1, int(obj.h * self.zoom))
                pygame.draw.rect(self.screen, (255, 255, 0), pygame.Rect(sx - 2, sy - 2, sw + 4, sh + 4), 3)
        
        # Draw sidebar when in NPC mode or NPC is selected
        if self.current_type == "npc" or self.selected_npc:
            self.sidebar_visible = True
            self.draw_sidebar(screen)
        # Draw stairs sidebar when in stairs mode or stairs is selected
        elif self.current_type == "stairs" or self.selected_stairs:
            self.sidebar_visible = True
            self.draw_stairs_sidebar(screen)
        else:
            self.sidebar_visible = False
        
        # Highlight selected stairs with a colored border
        if self.selected_stairs:
            sx = int(self.selected_stairs.x * self.zoom + self.offset_x)
            sy = int(self.selected_stairs.y * self.zoom + self.offset_y)
            sw = max(1, int(self.selected_stairs.w * self.zoom))
            sh = max(1, int(self.selected_stairs.h * self.zoom))
            pygame.draw.rect(self.screen, (255, 200, 100), pygame.Rect(sx - 2, sy - 2, sw + 4, sh + 4), 3)
        
        # UI Info (adjust position if sidebar is visible)
        info_x = 10
        if self.sidebar_visible:
            # Move info bar left if sidebar is visible to avoid overlap
            pass  # Keep it where it is for now
        bld = f" Building {self.selected_building_index + 1}/{len(self.buildings)} |" if self.buildings else ""
        label = self.font.render(
            f"Mode: {self.current_type.upper()} | L=Line W=Wall E=Exit T=Stairs N=NPC S=Save O=Load | B=Back to site{bld} P=Pan | Grid {self.grid_width}x{self.grid_height}",
            True, (255,255,255)
        )
        self.screen.blit(label, (info_x, 10))
        self.draw_layer_controls(screen)



    def save_map(self, filepath=None):
        """Save map to project file. If filepath is None, uses self.project_path or prompts for save."""
        # Push current building's layers if we're in building mode
        self._sync_layers_to_building()

        # Flatten all buildings' layers for simulation (one list of floors: b1f1, b1f2, b2f1, ...)
        all_layers = []
        for b in self.buildings:
            all_layers.extend(b.get("layers", [[]]))
        if not all_layers and self.buildings:
            all_layers = [[]]
        # If no buildings, use current editor layers (e.g. legacy or empty)
        if not self.buildings:
            all_layers = [list(l) for l in self.layers] if self.layers else [[]]

        # Build layered grids from flattened layers
        grids = []
        for layer in all_layers:
            grids.append(self.rasterize_walls_to_grid(objects=layer))

        environment_data = {
            "cell_size": self.cell_size,
            "width": self.grid_width,
            "height": self.grid_height,
            "active_layer": 0,
            "layers": [[obj.to_dict() for obj in layer] for layer in all_layers]
        }
        grid_data = {
            "cell_size": self.cell_size,
            "width": self.grid_width,
            "height": self.grid_height,
            "active_layer": 0,
            "layers": grids
        }

        if filepath is None:
            filepath = self.project_path
        if filepath is None:
            filepath = self._save_file_dialog()
            if filepath is None:
                print("⚠️ Save cancelled")
                return

        # Project file: include buildings when we have the multi-building format
        project_data = {
            "version": "2.0" if self.buildings else "1.0",
            "cell_size": self.cell_size,
            "width": self.grid_width,
            "height": self.grid_height,
            "environment": environment_data,
            "grid": grid_data
        }
        if self.buildings:
            project_data["buildings"] = [
                {"name": b.get("name", f"Building {i+1}"), "outline": b["outline"].to_dict(), "layers": [[obj.to_dict() for obj in layer] for layer in b.get("layers", [[]])]}
                for i, b in enumerate(self.buildings)
            ]

        with open(filepath, "w") as f:
            json.dump(project_data, f, indent=4)

        self.project_path = filepath
        print(f"✅ Project saved to {filepath}")

        # Legacy files for simulation (flattened floors)
        with open("environment.json", "w") as f:
            json.dump(environment_data, f, indent=4)
        with open("grid.json", "w") as f:
            json.dump(grid_data, f, indent=4)
        with open("environment_single.json", "w") as f:
            json.dump([obj.to_dict() for obj in (all_layers[0] if all_layers else [])], f, indent=4)
        legacy_grid = {
            "cell_size": self.cell_size,
            "width": self.grid_width,
            "height": self.grid_height,
            "grid": grids[0] if grids else []
        }
        with open("grid_single.json", "w") as f:
            json.dump(legacy_grid, f, indent=4)
    
    def _save_file_dialog(self):
        """Open a save file dialog and return selected file path."""
        try:
            import tkinter as tk
            from tkinter import filedialog
            
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            
            filepath = filedialog.asksaveasfilename(
                title="Save Project File",
                defaultextension=".dsproj",
                filetypes=[("Disaster Simulation Project", "*.dsproj"), ("All Files", "*.*")],
                initialdir=os.getcwd()
            )
            
            root.destroy()
            return filepath if filepath else None
        except Exception as e:
            print(f"⚠️ Error opening save dialog: {e}")
            return None

    def load_map(self, filepath=None):
        """Load map from project file. If filepath is None, tries to load from self.project_path or environment.json."""
        if filepath is None:
            filepath = self.project_path or "environment.json"

        try:
            with open(filepath, "r") as f:
                data = json.load(f)

            self.project_path = filepath

            # New format: project with buildings (canvas + multiple buildings)
            if isinstance(data, dict) and data.get("buildings"):
                self.buildings = []
                for i, b in enumerate(data["buildings"]):
                    outline = BuildingOutline.from_dict(b.get("outline", {"shape": "rect", "x": 0, "y": 0, "w": self.grid_width * self.cell_size, "h": self.grid_height * self.cell_size}))
                    layers_raw = b.get("layers", [[]])
                    layers = []
                    for layer_data in layers_raw:
                        layer_objects = []
                        for d in layer_data:
                            if d.get("type") == "line":
                                layer_objects.append(WallLine.from_dict(d))
                            else:
                                layer_objects.append(MapObject.from_dict(d))
                        layers.append(layer_objects)
                    if not layers:
                        layers = [[]]
                    name = b.get("name", f"Building {i+1}")
                    self.buildings.append({"name": name, "outline": outline, "layers": layers})
                if data.get("cell_size") is not None:
                    self.cell_size = data["cell_size"]
                if data.get("width") is not None:
                    self.grid_width = data["width"]
                if data.get("height") is not None:
                    self.grid_height = data["height"]
                self.editor_mode = "canvas"
                self.selected_building_index = None
                self.selected_outline_index = None
                self.layers = [[]]
                self._set_active_layer(0)
                print(f"✅ Loaded project with {len(self.buildings)} building(s). Canvas mode.")
                return
            # Legacy: single "building" (environment layers only)
            if isinstance(data, dict) and "environment" in data:
                env_data = data.get("environment", {})
                self._load_environment_data(env_data)
                # Wrap as one building with full-grid outline so user can edit as before
                full_w = self.grid_width * self.cell_size
                full_h = self.grid_height * self.cell_size
                self.buildings = [{"name": "Building 1", "outline": BuildingOutline(shape="rect", x=0, y=0, w=full_w, h=full_h), "layers": [list(l) for l in self.layers]}]
                self.editor_mode = "building"
                self.selected_building_index = 0
                self.selected_outline_index = 0
                print(f"✅ Loaded legacy project as 1 building with {len(self.layers)} floor(s).")
            elif isinstance(data, dict) and "layers" in data:
                self._load_environment_data(data)
                full_w = self.grid_width * self.cell_size
                full_h = self.grid_height * self.cell_size
                self.buildings = [{"name": "Building 1", "outline": BuildingOutline(shape="rect", x=0, y=0, w=full_w, h=full_h), "layers": [list(l) for l in self.layers]}]
                self.editor_mode = "building"
                self.selected_building_index = 0
                self.selected_outline_index = 0
                print(f"✅ Loaded legacy project as 1 building with {len(self.layers)} floor(s).")
            else:
                self.layers = [[]]
                for d in data:
                    if d["type"] == "line":
                        self.layers[0].append(WallLine.from_dict(d))
                    else:
                        self.layers[0].append(MapObject.from_dict(d))
                self._set_active_layer(0)
                full_w = self.grid_width * self.cell_size
                full_h = self.grid_height * self.cell_size
                self.buildings = [{"name": "Building 1", "outline": BuildingOutline(shape="rect", x=0, y=0, w=full_w, h=full_h), "layers": [list(l) for l in self.layers]}]
                self.editor_mode = "building"
                self.selected_building_index = 0
                self.selected_outline_index = 0

            for i, exit in enumerate(self.exits):
                exit.id = i

            print(f"✅ Map loaded from {filepath}")

        except FileNotFoundError:
            print(f"⚠️ File not found: {filepath}")
        except Exception as e:
            print(f"⚠️ Error loading map: {e}")
            import traceback
            traceback.print_exc()
    
    def _load_environment_data(self, data):
        """Helper to load environment data (handles layered format)."""
        if isinstance(data, dict) and "layers" in data:
            self.layers = []
            for layer_data in data.get("layers", []):
                layer_objects = []
                for d in layer_data:
                    if d["type"] == "line":
                        layer_objects.append(WallLine.from_dict(d))
                    else:
                        layer_objects.append(MapObject.from_dict(d))
                self.layers.append(layer_objects)
            if not self.layers:
                self.layers = [[]]
            self._set_active_layer(data.get("active_layer", 0))
            
            # Update grid settings if available
            if "cell_size" in data:
                self.cell_size = data.get("cell_size", 10)
            if "width" in data:
                self.grid_width = data.get("width", 80)
            if "height" in data:
                self.grid_height = data.get("height", 60)

    def draw_sidebar(self, screen):
        """Draw a full-height sidebar for editing NPC parameters."""
        screen_width = screen.get_width()
        screen_height = screen.get_height()
        sidebar_x = screen_width - self.sidebar_width
        sidebar_y = 0
        
        # Draw sidebar background (dark with border)
        sidebar_rect = pygame.Rect(sidebar_x, sidebar_y, self.sidebar_width, screen_height)
        pygame.draw.rect(screen, (35, 35, 40), sidebar_rect)  # Dark blue-gray background
        pygame.draw.rect(screen, (80, 80, 90), sidebar_rect, 2)  # Border
        pygame.draw.line(screen, (60, 60, 70), (sidebar_x, 0), (sidebar_x, screen_height), 3)  # Left border line
        
        # Draw header section
        header_height = 60
        header_rect = pygame.Rect(sidebar_x, sidebar_y, self.sidebar_width, header_height)
        pygame.draw.rect(screen, (45, 45, 55), header_rect)  # Slightly lighter header
        pygame.draw.line(screen, (100, 100, 110), (sidebar_x, header_height), 
                        (sidebar_x + self.sidebar_width, header_height), 2)
        
        # Header title
        title_text = self.sidebar_font_large.render("NPC Editor", True, (255, 255, 100))
        screen.blit(title_text, (sidebar_x + 15, 15))
        
        y_pos = header_height + 20
        
        if self.selected_npc:
            # Selected NPC info section
            section_title = self.sidebar_font_medium.render("Selected NPC", True, (200, 200, 255))
            screen.blit(section_title, (sidebar_x + 15, y_pos))
            y_pos += 35
            
            # Speed control section
            speed_label = self.sidebar_font_small.render("Agent Speed", True, (255, 255, 255))
            screen.blit(speed_label, (sidebar_x + 15, y_pos))
            y_pos += 25
            
            # Current speed value (larger, prominent)
            speed_value_text = self.sidebar_font_medium.render(f"{self.selected_npc.speed:.2f}", True, (100, 255, 100))
            screen.blit(speed_value_text, (sidebar_x + 15, y_pos))
            y_pos += 35
            
            # Speed slider
            slider_start_x = sidebar_x + 30
            slider_y = y_pos
            slider_end_x = slider_start_x + self.speed_slider_width
            
            # Store slider position for click detection
            self.speed_slider_x = slider_start_x
            self.speed_slider_y = slider_y
            
            # Draw slider track background
            track_rect = pygame.Rect(slider_start_x, slider_y, self.speed_slider_width, self.speed_slider_height)
            pygame.draw.rect(screen, (25, 25, 30), track_rect)
            pygame.draw.rect(screen, (70, 70, 80), track_rect, 2)
            
            # Calculate slider handle position (0.5 to 5.0 range)
            speed_min, speed_max = 0.5, 5.0
            speed_range = speed_max - speed_min
            current_speed = max(speed_min, min(speed_max, self.selected_npc.speed))
            ratio = (current_speed - speed_min) / speed_range
            handle_x = slider_start_x + int(ratio * self.speed_slider_width)
            
            # Draw filled portion of slider (visual feedback)
            filled_width = int(ratio * self.speed_slider_width)
            if filled_width > 0:
                filled_rect = pygame.Rect(slider_start_x, slider_y, filled_width, self.speed_slider_height)
                pygame.draw.rect(screen, (50, 100, 200), filled_rect)
            
            # Draw slider handle (more prominent)
            handle_rect = pygame.Rect(handle_x - 8, slider_y - 4, 16, self.speed_slider_height + 8)
            pygame.draw.rect(screen, (100, 150, 255), handle_rect)  # Bright blue handle
            pygame.draw.rect(screen, (255, 255, 255), handle_rect, 2)
            
            y_pos += self.speed_slider_height + 15
            
            # Speed range labels
            min_label = self.sidebar_font_small.render("0.5", True, (150, 150, 150))
            max_label = self.sidebar_font_small.render("5.0", True, (150, 150, 150))
            screen.blit(min_label, (slider_start_x, y_pos))
            screen.blit(max_label, (slider_end_x - 25, y_pos))
            y_pos += 30
            
            # Instructions
            instruction_text = self.sidebar_font_small.render("Drag slider to adjust", True, (180, 180, 180))
            screen.blit(instruction_text, (sidebar_x + 15, y_pos))
            y_pos += 40
            
            # NPC properties
            props_title = self.sidebar_font_small.render("NPC Properties:", True, (200, 200, 200))
            screen.blit(props_title, (sidebar_x + 15, y_pos))
            y_pos += 25
            
            # Position info
            pos_text = self.sidebar_font_small.render(f"Position: ({int(self.selected_npc.x)}, {int(self.selected_npc.y)})", 
                                                     True, (150, 150, 150))
            screen.blit(pos_text, (sidebar_x + 15, y_pos))
            y_pos += 20
            
            size_text = self.sidebar_font_small.render(f"Size: {int(self.selected_npc.w)} × {int(self.selected_npc.h)}", 
                                                       True, (150, 150, 150))
            screen.blit(size_text, (sidebar_x + 15, y_pos))
            
        else:
            # No NPC selected - show instructions
            y_pos += 10
            instruction_text = self.sidebar_font_small.render("NPC Mode Active", True, (200, 200, 255))
            screen.blit(instruction_text, (sidebar_x + 15, y_pos))
            y_pos += 40
            
            instructions = [
                "1. Draw an NPC zone",
                "   (click and drag)",
                "",
                "2. Click the NPC to",
                "   select it",
                "",
                "3. Adjust speed using",
                "   the slider",
                "",
                "Press N to exit",
                "NPC mode"
            ]
            
            for line in instructions:
                if line:
                    text = self.sidebar_font_small.render(line, True, (180, 180, 180))
                    screen.blit(text, (sidebar_x + 15, y_pos))
                y_pos += 22

    def _draw_canvas_building_properties(self, screen):
        """When a building is selected on canvas, draw a properties panel with name (editable)."""
        self.building_name_rect = None
        if self.selected_outline_index is None or self.selected_outline_index >= len(self.buildings):
            return
        b = self.buildings[self.selected_outline_index]
        name = b.get("name", "Building")
        sw = screen.get_width()
        # Panel on the right side
        panel_w = 260
        panel_x = sw - panel_w - 10
        panel_y = 80
        panel_h = 100
        panel_rect = pygame.Rect(panel_x, panel_y, panel_w, panel_h)
        pygame.draw.rect(screen, (40, 45, 55), panel_rect, border_radius=6)
        pygame.draw.rect(screen, (90, 100, 120), panel_rect, 2, border_radius=6)
        screen.blit(self.sidebar_font_medium.render("Building properties", True, (255, 255, 200)), (panel_x + 12, panel_y + 8))
        screen.blit(self.font.render("Name:", True, (200, 200, 200)), (panel_x + 12, panel_y + 38))
        # Editable name field (click to edit)
        name_w = panel_w - 50
        name_rect = pygame.Rect(panel_x + 12, panel_y + 56, name_w, 26)
        self.building_name_rect = name_rect
        color = (60, 70, 90) if not self.editing_building_name else (70, 80, 100)
        pygame.draw.rect(screen, color, name_rect, border_radius=3)
        pygame.draw.rect(screen, (120, 140, 180) if self.editing_building_name else (80, 90, 110), name_rect, 1, border_radius=3)
        display_name = name if name else "(click to set name)"
        name_surf = self.font.render(display_name[:32], True, (255, 255, 255))
        screen.blit(name_surf, (name_rect.x + 6, name_rect.y + 5))
        if self.editing_building_name:
            screen.blit(self.font.render("_", True, (255, 255, 200)), (name_rect.x + 6 + name_surf.get_width() + 2, name_rect.y + 5))
        hint = "F2 or click name to rename" if not self.editing_building_name else "Type then Enter"
        screen.blit(self.font.render(hint, True, (140, 140, 150)), (panel_x + 12, panel_y + 86))

    def _draw_canvas_toolbar(self, screen):
        """Draw canvas mode toolbar: Square, Polygon, Edit building."""
        y = 38
        x = 10
        bw, bh = 70, 28
        self.canvas_button_rects = {}
        # Square
        r1 = pygame.Rect(x, y, bw, bh)
        self.canvas_button_rects["square"] = r1
        c1 = (80, 120, 80) if self.canvas_tool == "square" else (60, 60, 70)
        pygame.draw.rect(screen, c1, r1, border_radius=4)
        pygame.draw.rect(screen, (140, 140, 150), r1, 1, border_radius=4)
        screen.blit(self.font.render("Square", True, (240, 240, 240)), (r1.x + 8, r1.y + 6))
        # Polygon
        r2 = pygame.Rect(x + bw + 8, y, bw, bh)
        self.canvas_button_rects["polygon"] = r2
        c2 = (80, 120, 80) if self.canvas_tool == "polygon" else (60, 60, 70)
        pygame.draw.rect(screen, c2, r2, border_radius=4)
        pygame.draw.rect(screen, (140, 140, 150), r2, 1, border_radius=4)
        screen.blit(self.font.render("Polygon", True, (240, 240, 240)), (r2.x + 6, r2.y + 6))
        # Edit building (only enabled when one selected)
        r3 = pygame.Rect(x + 2 * (bw + 8), y, 100, bh)
        self.canvas_button_rects["edit_building"] = r3
        c3 = (60, 100, 140) if self.selected_outline_index is not None else (50, 50, 55)
        pygame.draw.rect(screen, c3, r3, border_radius=4)
        pygame.draw.rect(screen, (140, 140, 150), r3, 1, border_radius=4)
        screen.blit(self.font.render("Edit building", True, (240, 240, 240)), (r3.x + 6, r3.y + 6))

    def draw_layer_controls(self, screen):
        """Draw small UI controls for layer navigation/add/remove."""
        y = 44
        x = 10
        w, h = self.layer_button_size

        def button(rect, label, color=(80, 80, 80)):
            pygame.draw.rect(screen, color, rect, border_radius=4)
            pygame.draw.rect(screen, (160, 160, 160), rect, 1, border_radius=4)
            text = self.font.render(label, True, (240, 240, 240))
            screen.blit(text, (rect.x + 6, rect.y + 4))

        # Prev / Next buttons
        prev_rect = pygame.Rect(x, y, w, h)
        next_rect = pygame.Rect(x + (w + 6), y, w, h)
        add_rect = pygame.Rect(x + 2*(w + 6), y, w, h)
        rem_rect = pygame.Rect(x + 3*(w + 6), y, w, h)
        self.layer_button_rects = {
            "prev": prev_rect,
            "next": next_rect,
            "add": add_rect,
            "remove": rem_rect
        }

        button(prev_rect, "<")
        button(next_rect, ">")
        button(add_rect, "+")
        button(rem_rect, "-")

        # Floor status text
        status = self.font.render(
            f"Floor {self.active_layer + 1}/{len(self.layers)}",
            True,
            (255, 255, 255)
        )
        screen.blit(status, (rem_rect.right + 10, y + 4))

    def draw_stairs_sidebar(self, screen):
        """Draw a full-height sidebar for editing Stairs parameters."""
        screen_width = screen.get_width()
        screen_height = screen.get_height()
        sidebar_x = screen_width - self.sidebar_width
        sidebar_y = 0
        
        # Draw sidebar background (dark with border)
        sidebar_rect = pygame.Rect(sidebar_x, sidebar_y, self.sidebar_width, screen_height)
        pygame.draw.rect(screen, (40, 35, 30), sidebar_rect)  # Dark orange-brown background
        pygame.draw.rect(screen, (90, 80, 70), sidebar_rect, 2)  # Border
        pygame.draw.line(screen, (70, 60, 50), (sidebar_x, 0), (sidebar_x, screen_height), 3)  # Left border line
        
        # Draw header section
        header_height = 60
        header_rect = pygame.Rect(sidebar_x, sidebar_y, self.sidebar_width, header_height)
        pygame.draw.rect(screen, (55, 45, 40), header_rect)  # Slightly lighter header
        pygame.draw.line(screen, (110, 100, 90), (sidebar_x, header_height), 
                        (sidebar_x + self.sidebar_width, header_height), 2)
        
        # Header title
        title_text = self.sidebar_font_large.render("Stairs Editor", True, (255, 200, 100))
        screen.blit(title_text, (sidebar_x + 15, 15))
        
        y_pos = header_height + 20
        
        if self.selected_stairs:
            # Selected Stairs info section
            section_title = self.sidebar_font_medium.render("Selected Stairs", True, (255, 220, 180))
            screen.blit(section_title, (sidebar_x + 15, y_pos))
            y_pos += 35
            
            # Ensure stairs has name and connects_to attributes (backwards compatibility)
            if not hasattr(self.selected_stairs, 'name'):
                old_id = getattr(self.selected_stairs, 'connection_id', None) or getattr(self.selected_stairs, 'link_id', None)
                self.selected_stairs.name = f"Stair{old_id}" if old_id else f"Stair{Stairs._name_counter}"
                Stairs._name_counter += 1
            if not hasattr(self.selected_stairs, 'connects_to'):
                self.selected_stairs.connects_to = ""
            
            # Stairs Name section
            name_label = self.sidebar_font_small.render("Stairs Name", True, (255, 255, 255))
            screen.blit(name_label, (sidebar_x + 15, y_pos))
            y_pos += 25
            
            editing_field = getattr(self, '_editing_stairs_field', 'connects_to')
            name_color = (255, 255, 200) if editing_field == 'name' else (255, 200, 100)
            name_value_text = self.sidebar_font_medium.render(f"{self.selected_stairs.name}", True, name_color)
            screen.blit(name_value_text, (sidebar_x + 15, y_pos))
            y_pos += 35
            
            # Connects To section
            connects_label = self.sidebar_font_small.render("Connects To", True, (255, 255, 255))
            screen.blit(connects_label, (sidebar_x + 15, y_pos))
            y_pos += 25
            
            connects_color = (255, 255, 200) if editing_field == 'connects_to' else (255, 200, 100)
            connects_value_text = self.sidebar_font_medium.render(f"{self.selected_stairs.connects_to if self.selected_stairs.connects_to else '(none)'}", True, connects_color)
            screen.blit(connects_value_text, (sidebar_x + 15, y_pos))
            y_pos += 35
            
            # Instructions
            instruction_text = self.sidebar_font_small.render("TAB: Switch field", True, (180, 180, 180))
            screen.blit(instruction_text, (sidebar_x + 15, y_pos))
            y_pos += 18
            instruction_text2 = self.sidebar_font_small.render("Type to edit", True, (180, 180, 180))
            screen.blit(instruction_text2, (sidebar_x + 15, y_pos))
            y_pos += 18
            help_text = self.sidebar_font_small.render("Enter name of target", True, (150, 150, 150))
            screen.blit(help_text, (sidebar_x + 15, y_pos))
            y_pos += 18
            help_text2 = self.sidebar_font_small.render("stairs to connect", True, (150, 150, 150))
            screen.blit(help_text2, (sidebar_x + 15, y_pos))
            y_pos += 30
            
            # Connection info - show target stairs
            connection_info_label = self.sidebar_font_small.render("Connection", True, (255, 255, 255))
            screen.blit(connection_info_label, (sidebar_x + 15, y_pos))
            y_pos += 25
            
            # Find the target stairs by name
            target_stairs = None
            if self.selected_stairs.connects_to:
                for layer_idx, layer_objects in enumerate(self.layers):
                    for obj in layer_objects:
                        if obj.type == "stairs" and getattr(obj, 'name', None) == self.selected_stairs.connects_to:
                            target_stairs = (layer_idx, obj)
                            break
                    if target_stairs:
                        break
            
            # Show connection status
            if target_stairs:
                layer_idx, stairs_obj = target_stairs
                conn_text = self.sidebar_font_small.render(f"→ {self.selected_stairs.connects_to}", True, (150, 255, 150))
                screen.blit(conn_text, (sidebar_x + 15, y_pos))
                y_pos += 18
                layer_text = self.sidebar_font_small.render(f"  Floor {layer_idx + 1}", True, (150, 150, 150))
                screen.blit(layer_text, (sidebar_x + 15, y_pos))
                y_pos += 20
            else:
                if self.selected_stairs.connects_to:
                    no_conn_text = self.sidebar_font_small.render(f"'{self.selected_stairs.connects_to}' not found", True, (255, 150, 150))
                else:
                    no_conn_text = self.sidebar_font_small.render("Not connected", True, (150, 150, 150))
                screen.blit(no_conn_text, (sidebar_x + 15, y_pos))
                y_pos += 20
            
            # Always show available stairs names (clickable buttons)
            all_stairs = []
            for layer_idx, layer_objects in enumerate(self.layers):
                for obj in layer_objects:
                    if obj.type == "stairs" and obj != self.selected_stairs:
                        stairs_name = getattr(obj, 'name', None)
                        if stairs_name:
                            all_stairs.append((layer_idx, obj, stairs_name))
            
            if all_stairs:
                hint_text = self.sidebar_font_small.render("Available stairs (click to connect):", True, (120, 120, 120))
                screen.blit(hint_text, (sidebar_x + 15, y_pos))
                y_pos += 18
                
                # Store button rects for click detection
                self.available_stairs_buttons = []
                
                for layer_idx, stairs_obj, stairs_name in all_stairs[:6]:  # Show max 6
                    # Create clickable button for each stairs
                    button_rect = pygame.Rect(sidebar_x + 15, y_pos, 240, 22)
                    self.available_stairs_buttons.append((button_rect, stairs_name))
                    
                    # Highlight if this is the current connection target
                    is_current_target = self.selected_stairs.connects_to == stairs_name
                    button_color = (80, 120, 80) if is_current_target else (60, 60, 60)
                    border_color = (150, 255, 150) if is_current_target else (100, 100, 100)
                    
                    pygame.draw.rect(screen, button_color, button_rect, border_radius=3)
                    pygame.draw.rect(screen, border_color, button_rect, 1, border_radius=3)
                    
                    # Draw stairs name and floor
                    text_color = (200, 255, 200) if is_current_target else (180, 180, 180)
                    stairs_text = self.sidebar_font_small.render(f"{stairs_name} (Floor {layer_idx + 1})", True, text_color)
                    screen.blit(stairs_text, (button_rect.x + 5, button_rect.y + 4))
                    y_pos += 24
            else:
                self.available_stairs_buttons = []
                no_stairs_text = self.sidebar_font_small.render("No other stairs available", True, (100, 100, 100))
                screen.blit(no_stairs_text, (sidebar_x + 15, y_pos))
                y_pos += 20
            y_pos += 10
            
            # Stairs properties
            props_title = self.sidebar_font_small.render("Stairs Properties:", True, (200, 200, 200))
            screen.blit(props_title, (sidebar_x + 15, y_pos))
            y_pos += 25
            
            # Position info
            pos_text = self.sidebar_font_small.render(f"Position: ({int(self.selected_stairs.x)}, {int(self.selected_stairs.y)})", 
                                                     True, (150, 150, 150))
            screen.blit(pos_text, (sidebar_x + 15, y_pos))
            y_pos += 20
            
            size_text = self.sidebar_font_small.render(f"Size: {int(self.selected_stairs.w)} × {int(self.selected_stairs.h)}", 
                                                       True, (150, 150, 150))
            screen.blit(size_text, (sidebar_x + 15, y_pos))
            y_pos += 20
            
            # ID info
            id_text = self.sidebar_font_small.render(f"ID: {self.selected_stairs.id}", True, (150, 150, 150))
            screen.blit(id_text, (sidebar_x + 15, y_pos))
            
        else:
            # No stairs selected - show instructions
            y_pos += 10
            instruction_text = self.sidebar_font_small.render("Stairs Mode Active", True, (255, 220, 180))
            screen.blit(instruction_text, (sidebar_x + 15, y_pos))
            y_pos += 40
            
            instructions = [
                "1. Draw a stairs zone",
                "   (click and drag)",
                "",
                "2. Click the stairs to",
                "   select it",
                "",
                "3. Set link name to",
                "   connect stairs (same name)",
                "",
                "Press T to exit",
                "Stairs mode"
            ]
            
            for line in instructions:
                if line:
                    text = self.sidebar_font_small.render(line, True, (180, 180, 180))
                    screen.blit(text, (sidebar_x + 15, y_pos))
                y_pos += 22

    