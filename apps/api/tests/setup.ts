import { afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";

// Închide conexiunile curat la finalul fiecărui fișier, în loc să le lase tăiate la ieșirea procesului.
afterAll(() => prisma.$disconnect());
