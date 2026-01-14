export async function onRequest(context) {
  const body = await context.request.json().catch(() => ({}));
  const user = body.user;
  const pass = body.pass;

  // بيانات أدمن مؤقتة
  const ADMIN_USER = "bahaahajaj@btec.com";
  const ADMIN_PASS = "bahaahajaj0775135361btec2007";

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return new Response(
      JSON.stringify({
        ok: true,
        token: "ADMIN_TOKEN_DEMO"
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: "اسم المستخدم أو كلمة المرور خطأ"
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
