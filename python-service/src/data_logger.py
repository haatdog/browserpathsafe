# # src/data_logger.py
# import csv
# import os

# class DataLogger:
#     def __init__(self, filename="simulation_data.csv"):
#         self.filename = filename
#         self.data = []

#         # Prepare CSV file with headers
#         if not os.path.exists(filename):
#             with open(filename, "w", newline="") as f:
#                 writer = csv.writer(f)
#                 writer.writerow(["Time (s)", "Evacuated Agents"])

#     def log(self, elapsed_time, evacuated_agents):
#         """Store the simulation data in memory and append to CSV."""
#         self.data.append((elapsed_time, evacuated_agents))
#         with open(self.filename, "a", newline="") as f:
#             writer = csv.writer(f)
#             writer.writerow([round(elapsed_time, 2), evacuated_agents])
import csv
import os
import time

class DataLogger:
    def __init__(self, filename="simulation_data.csv"):
        self.filename = filename
        self.data = []
        self.start_time = time.time()

        # ✅ Expanded CSV headers
        headers = [
            "Time (s)",
            "Evacuated Agents",
            "Total Agents",
            "Average Evacuation Time",
            "Average Distance Traveled (m)",
            "Exit Usage"
        ]

        if not os.path.exists(filename):
            with open(filename, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(headers)

    def log(self, elapsed_time, evacuated_agents, total_agents, avg_time, avg_distance, exit_usage):
        """Store extended simulation data and write to CSV."""
        row = [
            round(elapsed_time, 2),
            evacuated_agents,
            total_agents,
            round(avg_time, 2),
            round(avg_distance, 2),
            dict(exit_usage)  # store as dictionary (or stringified)
        ]
        self.data.append(row)

        with open(self.filename, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(row)
