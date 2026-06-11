import { NextResponse } from "next/server";
import { redeemInvite, InviteError } from "@/lib/invites/service";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await redeemInvite({ token, email, passwordHash, displayName });
    return NextResponse.json({ userId: result.userId });
  } catch (e) {
    if (e instanceof InviteError) {
      const code = e.code === "email_taken" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status: code });
    }
    throw e;
  }
}
