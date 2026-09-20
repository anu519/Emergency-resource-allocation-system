const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler, ApiError } = require("../middleware/errorHandler");

const signupSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(6),
});

function issueToken(user) {
  return jwt.sign({ id: user.id, phone: user.phone }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

const signup = asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (existing) throw new ApiError(409, "An account with this phone number already exists.");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, phone: data.phone, email: data.email, passwordHash },
  });

  const token = issueToken(user);
  res.status(201).json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
});

const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (!user) throw new ApiError(401, "Invalid phone number or password.");

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid phone number or password.");

  const token = issueToken(user);
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  });
  if (!user) throw new ApiError(404, "User not found.");
  res.json({ user });
});

module.exports = { signup, login, me };
