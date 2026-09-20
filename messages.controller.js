const { z } = require("zod");
const prisma = require("../config/db");
const { asyncHandler } = require("../middleware/errorHandler");

const history = asyncHandler(async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { userId: req.user.id, doctorId: req.params.doctorId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ messages });
});

const sendSchema = z.object({
  doctorId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  sender: z.enum(["USER", "DOCTOR"]).default("USER"),
});

/** POST /messages — persists a chat message. The socket layer
 *  (`chat:message` event) handles instant delivery to the open tab; this
 *  REST call is what makes it durable so history survives a refresh. */
const send = asyncHandler(async (req, res) => {
  const data = sendSchema.parse(req.body);
  const message = await prisma.message.create({
    data: { userId: req.user.id, doctorId: data.doctorId, text: data.text, sender: data.sender },
  });
  res.status(201).json({ message });
});

module.exports = { history, send };
