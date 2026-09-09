import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, unauthorized } from "../lib/http";
import { authenticate, signToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) throw unauthorized("Invalid email or password");
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    res.json({ token: signToken(payload), user: payload });
  })
);

router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));

export default router;
