import sys

class Rectangle:
    def __init__(self):
        self.length = 0
        self.width = 0


rectangle = Rectangle()
parts = sys.stdin.read().split()
rectangle.length = int(parts[0])
rectangle.width = int(parts[1])
print(rectangle.length * rectangle.width)
