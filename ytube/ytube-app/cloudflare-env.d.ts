declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    YTUBE_SELF_HOSTED?: string;
    YTUBE_REGISTRATION_OPEN?: string;
  }
}
