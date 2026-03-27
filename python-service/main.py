# main.py
#main git test
import pygame
import os
from src.map_editor import MapEditor
from src.simulation import Simulation

# Set window position to center (must be before pygame.init())
# This helps if window was positioned off-screen
os.environ['SDL_VIDEO_CENTERED'] = '1'

pygame.init()
# Create a resizable window so user can see window controls
# Use a slightly smaller default size that fits better on most screens
screen = pygame.display.set_mode((1000, 700), pygame.RESIZABLE)
pygame.display.set_caption("Disaster Simulation")

# Start with startup page
startup = StartupPage(screen)
running = True
mode = "startup"  # startup, edit, or sim
editor = None
project_path = None

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
            if mode == "edit":
                # Return to startup
                mode = "startup"
                editor = None
                project_path = None
            elif mode == "startup":
                running = False
        elif mode == "startup":
            action = startup.handle_event(event)
            if action == "new":
                # Create new project
                editor = MapEditor(screen)
                project_path = None
                mode = "edit"
                pygame.display.set_caption("Disaster Simulation - New Project")
            elif action == "load_file_dialog":
                # Open file dialog
                filepath = startup.open_file_dialog()
                if filepath:
                    try:
                        editor = MapEditor(screen, project_path=filepath)
                        editor.load_map(filepath)
                        startup.add_recent_file(filepath)
                        project_path = filepath
                        mode = "edit"
                        pygame.display.set_caption(f"Disaster Simulation - {os.path.basename(filepath)}")
                    except Exception as e:
                        print(f"⚠️ Error loading project: {e}")
            elif action and isinstance(action, str) and action != "load_file_dialog" and action != "new":
                # Clicked on a recent file
                try:
                    filepath = action
                    editor = MapEditor(screen, project_path=filepath)
                    editor.load_map(filepath)
                    startup.add_recent_file(filepath)
                    project_path = filepath
                    mode = "edit"
                    pygame.display.set_caption(f"Disaster Simulation - {os.path.basename(filepath)}")
                except Exception as e:
                    print(f"⚠️ Error loading project: {e}")
        elif mode == "edit":
            editor.handle_event(event)
            # When SPACE is pressed, switch to simulation mode
            if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                # Save current map before simulation
                if editor.project_path:
                    editor.save_map(editor.project_path)
                else:
                    editor.save_map()  # Will prompt for save location
                
                # Load the simulation using the same screen
                sim = Simulation(screen)
                visualize(sim)  # 🔁 open the simulation window
                mode = "edit"  # return to edit mode after simulation ends

    # Draw current mode
    if mode == "startup":
        startup.draw()
        pygame.display.flip()
    elif mode == "edit":
        screen.fill((30, 30, 30))
        editor.draw(screen)
        pygame.display.flip()

pygame.quit()
