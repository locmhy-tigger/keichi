import { signIn } from "@/lib/auth"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2">AI 大智若愚</h1>
        <p className="text-gray-500 text-sm mb-8">智能學習平台</p>
        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 border rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            以學校 Google 帳號登入
          </button>
        </form>
      </div>
    </main>
  )
}
