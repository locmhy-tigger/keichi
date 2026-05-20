import { exec } from 'child_process';
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  startDate:   z.string().optional(),
  endDate:     z.string().nullable().optional(),
  allDay:      z.boolean().optional(),
  description: z.string().optional(),
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } })
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (event.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data    = patchSchema.parse(await req.json())
  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...data,
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate !== undefined
        ? { endDate: data.endDate ? new Date(data.endDate) : null }
        : {}),
    },
    include: { author: { select: { id: true, name: true } } },
  })

  // Logging hook
  const logTitle = "Calendar Event Updated";
  const logContent = `Event "${updated.title}" (${updated.id}) updated by ${session.user.name}`;
  const scriptPath = require('path').join(process.cwd(), "scripts", "save_to_obsidian.js");
  exec(`node "${scriptPath}" "${logTitle}" "${logContent}"`);

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } })
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (event.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.calendarEvent.delete({ where: { id: params.id } })
  
  // Logging hook
  const logTitle = "Calendar Event Deleted";
  const logContent = `Event "${event.title}" (${event.id}) deleted by ${session.user.name}`;
  const scriptPath = require('path').join(process.cwd(), "scripts", "save_to_obsidian.js");
  exec(`node "${scriptPath}" "${logTitle}" "${logContent}"`);

  return NextResponse.json({ deleted: true })
}
