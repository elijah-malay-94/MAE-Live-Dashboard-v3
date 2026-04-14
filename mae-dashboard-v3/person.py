class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


name = input().strip()
age = int(input())
person = Person(name, age)
print(person.name)
print(person.age)
