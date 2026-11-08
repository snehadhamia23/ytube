import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { user } from "../../lib/server";
import AuthForm from "./auth-form";

export const dynamic="force-dynamic";
export default async function AuthPage() {
  if(await user())redirect("/");
  return <AuthForm registrationOpen={env.YTUBE_REGISTRATION_OPEN!=="0"}/>;
}
