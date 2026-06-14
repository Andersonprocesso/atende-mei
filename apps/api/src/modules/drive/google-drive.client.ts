// Cliente Google Drive (REST v3) — espelha o padrão do Radar.
// Escopo drive.file (o app só enxerga o que ele próprio cria).
// OAuth: usa o refresh_token (autorizado uma vez) para obter access_token.

const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';

export class GoogleDriveError extends Error {}

export class GoogleDriveClient {
  private constructor(private readonly token: string) {}

  static async conectar(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<GoogleDriveClient> {
    const res = await fetch(OAUTH_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new GoogleDriveError(`Falha ao renovar token (reautorize o Drive): ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    return new GoogleDriveClient(json.access_token);
  }

  private get headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  private async acharPasta(nome: string, parentId: string | null): Promise<string | null> {
    const nomeQ = nome.replace(/'/g, "\\'");
    let q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${nomeQ}'`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const url = `${DRIVE_FILES}?${new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1' })}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new GoogleDriveError(`Busca de pasta falhou: ${(await res.text()).slice(0, 200)}`);
    const arquivos = (await res.json()).files ?? [];
    return arquivos[0]?.id ?? null;
  }

  private async criarPasta(nome: string, parentId: string | null): Promise<string> {
    const meta: any = { name: nome, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) meta.parents = [parentId];
    const res = await fetch(`${DRIVE_FILES}?fields=id`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    if (![200, 201].includes(res.status)) {
      throw new GoogleDriveError(`Criação de pasta falhou: ${(await res.text()).slice(0, 200)}`);
    }
    return (await res.json()).id;
  }

  // Garante a pasta (acha ou cria) e retorna o id.
  async garantirPasta(nome: string, parentId: string | null): Promise<string> {
    return (await this.acharPasta(nome, parentId)) ?? this.criarPasta(nome, parentId);
  }

  // Link de visualização da pasta.
  linkPasta(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }
}
