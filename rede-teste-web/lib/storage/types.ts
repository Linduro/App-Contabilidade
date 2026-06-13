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
