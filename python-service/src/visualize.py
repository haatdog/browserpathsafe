# src/visualize.py
import pygame
from src.stats import Stats

# def visualize(sim):
#     pygame.init()
#     screen = pygame.display.set_mode((sim.width, sim.height))
#     clock = pygame.time.Clock()
#     running = True

#     while running:
#         for event in pygame.event.get():
#             if event.type == pygame.QUIT:
#                 running = False

#         screen.fill((255, 255, 255))

#         # Draw walls
#         for obj in sim.objects:
#             if obj.type == "wall":
#                 pygame.draw.rect(screen, (50, 50, 50), (obj.x, obj.y, obj.w, obj.h))

#         # Draw exits
#         for obj in sim.objects:
#             if obj.type == "exit":
#                 pygame.draw.rect(screen, (0, 200, 0), (obj.x, obj.y, obj.w, obj.h))

#         # Draw agents
#         for agent in sim.agents:
#             color = (0, 0, 255) if not agent.evacuated else (150, 150, 150)
#             pygame.draw.circle(screen, color, (int(agent.pos[0]), int(agent.pos[1])), 6)

#             # Draw path (optional)
#             if agent.path:
#                 for node in agent.path:
#                     x = node[0] * sim.cell_size + sim.cell_size / 2
#                     y = node[1] * sim.cell_size + sim.cell_size / 2
#                     pygame.draw.circle(screen, (150, 200, 255), (int(x), int(y)), 2)

#         pygame.display.flip()
#         sim.update()
#         clock.tick(60)

#     # pygame.quit()
def visualize(sim):
    """Run the simulation - use sim.run() which handles everything."""
    # Use the simulation's run method which handles all events, drawing, and updates
    sim.run()
    
    # after simulation loop exits
    stats = Stats()
    summary = stats.summarize()
    print("Total evacuated:", summary["total"])
    print("Simulation time:", summary["max_time"], "seconds")
    stats.plot()
