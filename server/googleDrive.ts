import { google } from "googleapis";
import { storage } from "./storage";
import { Readable } from "stream";

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI);
}

export function getAuthUrl(redirectBase: string): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${redirectBase}/api/auth/google/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"],
  });
}

export async function exchangeCodeForToken(code: string, redirectBase: string): Promise<{ email: string; refreshToken: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${redirectBase}/api/auth/google/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return { email: data.email || "", refreshToken: tokens.refresh_token || "" };
}

export async function uploadPdfToDrive(
  pdfBase64: string,
  filename: string,
  folderId?: string | null
): Promise<{ fileId: string; webViewLink: string }> {
  const cfg = await storage.getWebConfig();
  const refreshToken = cfg?.google_refresh_token;
  if (!refreshToken) throw new Error("Google Drive belum terhubung");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const buffer = Buffer.from(pdfBase64, "base64");
  const stream = Readable.from(buffer);

  const targetFolder = folderId || cfg?.google_drive_folder_id || undefined;
  const fileMetadata: Record<string, any> = { name: filename, mimeType: "application/pdf" };
  if (targetFolder) fileMetadata.parents = [targetFolder];

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType: "application/pdf", body: stream },
    fields: "id, webViewLink",
  });

  return { fileId: res.data.id!, webViewLink: res.data.webViewLink || "" };
}

export async function createDriveFolder(
  name: string,
  parentFolderId?: string | null
): Promise<string> {
  const cfg = await storage.getWebConfig();
  const refreshToken = cfg?.google_refresh_token;
  if (!refreshToken) throw new Error("Google Drive belum terhubung");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const parent = parentFolderId || cfg?.google_drive_folder_id || undefined;

  const fileMetadata: Record<string, any> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parent) fileMetadata.parents = [parent];

  const res = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });
  return res.data.id!;
}

export async function uploadBufferToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderId?: string | null
): Promise<{ fileId: string; webViewLink: string }> {
  const cfg = await storage.getWebConfig();
  const refreshToken = cfg?.google_refresh_token;
  if (!refreshToken) throw new Error("Google Drive belum terhubung");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const stream = Readable.from(buffer);

  const fileMetadata: Record<string, any> = { name: filename, mimeType };
  if (folderId) fileMetadata.parents = [folderId];

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType, body: stream },
    fields: "id, webViewLink",
  });

  return { fileId: res.data.id!, webViewLink: res.data.webViewLink || "" };
}

export async function uploadJsonToDrive(
  jsonContent: string,
  filename: string,
  folderId?: string | null
): Promise<{ fileId: string; webViewLink: string }> {
  const cfg = await storage.getWebConfig();
  const refreshToken = cfg?.google_refresh_token;
  if (!refreshToken) throw new Error("Google Drive belum terhubung");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const buffer = Buffer.from(jsonContent, "utf-8");
  const stream = Readable.from(buffer);

  const targetFolder = folderId || cfg?.google_drive_folder_id || undefined;
  const fileMetadata: Record<string, any> = { name: filename, mimeType: "application/json" };
  if (targetFolder) fileMetadata.parents = [targetFolder];

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType: "application/json", body: stream },
    fields: "id, webViewLink",
  });

  return { fileId: res.data.id!, webViewLink: res.data.webViewLink || "" };
}

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
