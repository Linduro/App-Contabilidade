export type StoredObject = {
  publicPath: string;
  contentType: string;
};

export interface StorageProvider {
  putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  getPresignedPutUrl?(
    key: string,
    contentType: string,
    expiresSec?: number,
  ): Promise<string>;
}

export async function getStorageProvider(): Promise<StorageProvider> {
  return {
    async putObject(key, _body, contentType) {
      return {
        publicPath: `/uploads/${key.replace(/\\/g, "/")}`,
        contentType,
      };
    },
  };
}

export function getStorageClient() {
  return null;
}
