import csv
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import io
import pygame


class Stats:
    def __init__(self, filename="simulation_data.csv"):
        self.filename = filename
        self.data = self.load_data()

    def load_data(self):
        """Load time series of evacuated agents from CSV."""
        data = []
        with open(self.filename, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append({
                    "time": float(row["Time (s)"]),
                    "evacuated": int(row["Evacuated Agents"]),
                })
        return data

    def summarize(self):
        """Basic summary: how many evacuated, and how long it took."""
        if not self.data:
            return None
        total = self.data[-1]["evacuated"]
        max_time = self.data[-1]["time"]
        return {"total": total, "max_time": max_time}

    # --- Simple rules-based recommendation on evacuation speed ---
    def evaluate_efficiency(self):
        """
        Return a mock rules-based evaluation of evacuation efficiency
        based on total evacuation time.

        This is intentionally simple and explainable:
        - Excellent: very fast evacuation
        - Good: reasonable evacuation
        - Fair: a bit slow
        - Poor: very slow
        """
        summary = self.summarize()
        if not summary:
            return None

        total = summary["total"]
        max_time = summary["max_time"]

        # Define rough thresholds (in seconds); you can tune these later
        if max_time <= 60:
            rating = "Excellent"
            message = "Evacuation was very fast. Stair and exit layout looks highly efficient."
        elif max_time <= 120:
            rating = "Good"
            message = "Evacuation speed is good, but there may still be room to improve stair or exit placement."
        elif max_time <= 180:
            rating = "Fair"
            message = "Evacuation is somewhat slow. Consider adding more exits or balancing stair capacity between floors."
        else:
            rating = "Poor"
            message = "Evacuation was very slow. Consider redesigning routes, widening doors, or adding additional stairs/exits."

        return {
            "rating": rating,
            "message": message,
            "total_evacuated": total,
            "total_time": max_time,
        }

    def plot(self):
        """Plot evacuation curve and show a simple efficiency recommendation."""
        if not self.data:
            return

        times = [d["time"] for d in self.data]
        evac = [d["evacuated"] for d in self.data]

        plt.figure(figsize=(8, 5))

        # Main evacuation curve
        plt.plot(
            times, evac,
            color="#1f77b4",
            marker="o",
            markerfacecolor="#ff7f0e",
            linewidth=2.5,
            label="Evacuated Agents Over Time",
        )
        plt.grid(True, linestyle="--", alpha=0.6)
        plt.title("Evacuation Progress", fontsize=14, weight="bold")
        plt.xlabel("Time (s)", fontsize=12)
        plt.ylabel("Number of Evacuated Agents", fontsize=12)
        plt.legend(loc="upper left")

        # --- Rules-based efficiency box on the same chart ---
        eval_result = self.evaluate_efficiency()
        if eval_result:
            text_lines = [
                f"Efficiency rating: {eval_result['rating']}",
                f"Total evacuated: {eval_result['total_evacuated']} agents",
                f"Total time: {eval_result['total_time']:.1f} s",
                "",
                eval_result["message"],
            ]
            text = "\n".join(text_lines)

            # Place the text in the upper-right corner inside the axes
            plt.gca().text(
                0.98, 0.98, text,
                transform=plt.gca().transAxes,
                fontsize=9,
                va="top",
                ha="right",
                bbox=dict(boxstyle="round,pad=0.4", facecolor="white", alpha=0.8),
            )

        plt.tight_layout()
        plt.show()

    def render_to_surface(self, width=1000, height=700):
        """Render the graph and recommendation to a pygame surface."""
        if not self.data:
            return None
        
        times = [d["time"] for d in self.data]
        evac = [d["evacuated"] for d in self.data]
        
        # Create matplotlib figure with specific size (in inches, then convert to pixels)
        dpi = 100
        fig_width = width / dpi
        fig_height = height / dpi
        fig = plt.figure(figsize=(fig_width, fig_height), dpi=dpi)
        ax = fig.add_subplot(111)
        
        # Main evacuation curve
        ax.plot(
            times, evac,
            color="#1f77b4",
            marker="o",
            markerfacecolor="#ff7f0e",
            linewidth=2.5,
            label="Evacuated Agents Over Time",
        )
        ax.grid(True, linestyle="--", alpha=0.6)
        ax.set_title("Evacuation Progress", fontsize=14, weight="bold")
        ax.set_xlabel("Time (s)", fontsize=12)
        ax.set_ylabel("Number of Evacuated Agents", fontsize=12)
        ax.legend(loc="upper left")
        
        # --- Rules-based efficiency box on the same chart ---
        eval_result = self.evaluate_efficiency()
        if eval_result:
            text_lines = [
                f"Efficiency Rating: {eval_result['rating']}",
                f"Total Evacuated: {eval_result['total_evacuated']} agents",
                f"Total Time: {eval_result['total_time']:.1f} s",
                "",
                eval_result["message"],
            ]
            text = "\n".join(text_lines)
            
            # Place the text in the upper-right corner inside the axes
            ax.text(
                0.98, 0.98, text,
                transform=ax.transAxes,
                fontsize=10,
                va="top",
                ha="right",
                bbox=dict(boxstyle="round,pad=0.5", facecolor="white", alpha=0.9, edgecolor="gray"),
            )
        
        plt.tight_layout()
        
        # Convert matplotlib figure to pygame surface
        # Save figure to PNG bytes buffer
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight', pad_inches=0.1)
        buf.seek(0)
        
        # Load PNG from buffer into pygame surface
        surface = pygame.image.load(buf)
        buf.close()
        
        # Clean up matplotlib figure
        plt.close(fig)
        
        return surface
