import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const { title, content } = await req.json()
    const scriptPath = path.join(process.cwd(), "scripts", "save_to_obsidian.js")
    
    exec(`node "${scriptPath}" "${title}" "${content}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        return
      }
      console.log(`stdout: ${stdout}`)
      if (stderr) console.error(`stderr: ${stderr}`)
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to log" }, { status: 500 })
  }
}
