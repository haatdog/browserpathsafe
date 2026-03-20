# src/startup.py
import pygame
import json
import os
from datetime import datetime


class StartupPage:
    def __init__(self, screen):
        self.screen = screen
        self.width = screen.get_width()
        self.height = screen.get_height()
        
        # UI state
        self.recent_files = self.load_recent_files()
        self.hovered_button = None
        self.hovered_recent_file = None
        
        # Fonts
        self.title_font = pygame.font.Font(None, 48)
        self.button_font = pygame.font.Font(None, 32)
        self.recent_files_font = pygame.font.Font(None, 24)
        self.file_path_font = pygame.font.Font(None, 18)
        
        # Colors
        self.bg_color = (30, 30, 35)
        self.button_color = (60, 100, 140)
        self.button_hover_color = (80, 130, 180)
        self.button_text_color = (255, 255, 255)
        self.recent_file_bg = (40, 40, 45)
        self.recent_file_hover_bg = (50, 50, 60)
        self.text_color = (220, 220, 220)
        self.title_color = (255, 255, 255)
        
    def load_recent_files(self):
        """Load recent files from JSON file."""
        try:
            if os.path.exists("recent_files.json"):
                with open("recent_files.json", "r") as f:
                    data = json.load(f)
                    # Filter out files that no longer exist
                    recent = [f for f in data.get("recent_files", []) if os.path.exists(f.get("path", ""))]
                    return recent[:10]  # Keep only last 10
        except Exception as e:
            print(f"⚠️ Error loading recent files: {e}")
        return []
    
    def save_recent_files(self):
        """Save recent files to JSON file."""
        try:
            with open("recent_files.json", "w") as f:
                json.dump({"recent_files": self.recent_files}, f, indent=2)
        except Exception as e:
            print(f"⚠️ Error saving recent files: {e}")
    
    def add_recent_file(self, filepath):
        """Add a file to recent files list."""
        # Remove if already exists
        self.recent_files = [f for f in self.recent_files if f.get("path") != filepath]
        
        # Add to front
        filename = os.path.basename(filepath)
        self.recent_files.insert(0, {
            "path": filepath,
            "name": filename,
            "last_opened": datetime.now().isoformat()
        })
        
        # Keep only last 10
        self.recent_files = self.recent_files[:10]
        self.save_recent_files()
    
    def handle_event(self, event):
        """Handle pygame events and return action: 'new', 'load', filepath, or None."""
        if event.type == pygame.MOUSEMOTION:
            mx, my = event.pos
            self.update_hover(mx, my)
            
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1:  # Left click
                mx, my = event.pos
                action = self.handle_click(mx, my)
                return action
        
        return None
    
    def update_hover(self, mx, my):
        """Update hover states for buttons and recent files."""
        self.hovered_button = None
        self.hovered_recent_file = None
        
        # Check button hover
        button_y = self.height // 2 - 50
        new_button_rect = pygame.Rect(self.width // 2 - 120, button_y, 100, 50)
        load_button_rect = pygame.Rect(self.width // 2 + 20, button_y, 100, 50)
        
        if new_button_rect.collidepoint(mx, my):
            self.hovered_button = "new"
        elif load_button_rect.collidepoint(mx, my):
            self.hovered_button = "load"
        
        # Check recent files hover
        recent_start_y = self.height // 2 + 80
        for i, file_info in enumerate(self.recent_files):
            file_rect = pygame.Rect(50, recent_start_y + i * 50, self.width - 100, 45)
            if file_rect.collidepoint(mx, my):
                self.hovered_recent_file = i
                break
    
    def handle_click(self, mx, my):
        """Handle mouse click and return action."""
        button_y = self.height // 2 - 50
        new_button_rect = pygame.Rect(self.width // 2 - 120, button_y, 100, 50)
        load_button_rect = pygame.Rect(self.width // 2 + 20, button_y, 100, 50)
        
        # Check button clicks
        if new_button_rect.collidepoint(mx, my):
            return "new"
        elif load_button_rect.collidepoint(mx, my):
            return "load_file_dialog"
        
        # Check recent file clicks
        recent_start_y = self.height // 2 + 80
        for i, file_info in enumerate(self.recent_files):
            file_rect = pygame.Rect(50, recent_start_y + i * 50, self.width - 100, 45)
            if file_rect.collidepoint(mx, my):
                return file_info.get("path")
        
        return None
    
    def open_file_dialog(self):
        """Open a file dialog using tkinter and return selected file path."""
        try:
            import tkinter as tk
            from tkinter import filedialog
            
            # Hide the root window
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            
            # Open file dialog
            filepath = filedialog.askopenfilename(
                title="Open Project File",
                filetypes=[("Disaster Simulation Project", "*.dsproj"), ("All Files", "*.*")],
                initialdir=os.getcwd()
            )
            
            root.destroy()
            return filepath if filepath else None
        except Exception as e:
            print(f"⚠️ Error opening file dialog: {e}")
            return None
    
    def draw(self):
        """Draw the startup page."""
        self.screen.fill(self.bg_color)
        
        # Title
        title_text = self.title_font.render("Disaster Simulation", True, self.title_color)
        title_rect = title_text.get_rect(center=(self.width // 2, 100))
        self.screen.blit(title_text, title_rect)
        
        # Subtitle
        subtitle_text = self.recent_files_font.render("Create or load a project to begin", True, (180, 180, 180))
        subtitle_rect = subtitle_text.get_rect(center=(self.width // 2, 150))
        self.screen.blit(subtitle_text, subtitle_rect)
        
        # Buttons
        button_y = self.height // 2 - 50
        button_height = 50
        button_width = 100
        
        # New button
        new_x = self.width // 2 - 120
        new_color = self.button_hover_color if self.hovered_button == "new" else self.button_color
        new_button_rect = pygame.Rect(new_x, button_y, button_width, button_height)
        pygame.draw.rect(self.screen, new_color, new_button_rect, border_radius=5)
        pygame.draw.rect(self.screen, (100, 140, 180), new_button_rect, 2, border_radius=5)
        new_text = self.button_font.render("New", True, self.button_text_color)
        new_text_rect = new_text.get_rect(center=new_button_rect.center)
        self.screen.blit(new_text, new_text_rect)
        
        # Load button
        load_x = self.width // 2 + 20
        load_color = self.button_hover_color if self.hovered_button == "load" else self.button_color
        load_button_rect = pygame.Rect(load_x, button_y, button_width, button_height)
        pygame.draw.rect(self.screen, load_color, load_button_rect, border_radius=5)
        pygame.draw.rect(self.screen, (100, 140, 180), load_button_rect, 2, border_radius=5)
        load_text = self.button_font.render("Load", True, self.button_text_color)
        load_text_rect = load_text.get_rect(center=load_button_rect.center)
        self.screen.blit(load_text, load_text_rect)
        
        # Recent files section
        if self.recent_files:
            recent_label_y = self.height // 2 + 50
            recent_label = self.recent_files_font.render("Recent Files:", True, self.text_color)
            self.screen.blit(recent_label, (50, recent_label_y))
            
            recent_start_y = self.height // 2 + 80
            for i, file_info in enumerate(self.recent_files):
                file_y = recent_start_y + i * 50
                file_rect = pygame.Rect(50, file_y, self.width - 100, 45)
                
                # Background
                bg_color = self.recent_file_hover_bg if self.hovered_recent_file == i else self.recent_file_bg
                pygame.draw.rect(self.screen, bg_color, file_rect, border_radius=3)
                pygame.draw.rect(self.screen, (70, 70, 80), file_rect, 1, border_radius=3)
                
                # File name
                file_name = file_info.get("name", "Unknown")
                name_text = self.recent_files_font.render(file_name, True, self.text_color)
                self.screen.blit(name_text, (file_rect.x + 10, file_rect.y + 5))
                
                # File path (smaller, dimmer)
                file_path = file_info.get("path", "")
                # Truncate path if too long
                max_path_width = self.width - 200
                if self.file_path_font.size(file_path)[0] > max_path_width:
                    path_text = file_path[:50] + "..."
                else:
                    path_text = file_path
                path_surface = self.file_path_font.render(path_text, True, (150, 150, 150))
                self.screen.blit(path_surface, (file_rect.x + 10, file_rect.y + 28))
        
        # Footer
        footer_text = self.file_path_font.render("Press ESC to exit", True, (120, 120, 120))
        footer_rect = footer_text.get_rect(center=(self.width // 2, self.height - 30))
        self.screen.blit(footer_text, footer_rect)

