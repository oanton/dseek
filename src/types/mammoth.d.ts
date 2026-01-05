declare module 'mammoth' {
  interface ConversionMessage {
    type: 'warning' | 'error';
    message: string;
  }

  interface ConversionResult {
    value: string;
    messages: ConversionMessage[];
  }

  interface InputOptions {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }

  interface StyleMap {
    [key: string]: string;
  }

  interface ConversionOptions {
    styleMap?: string[] | StyleMap;
    includeDefaultStyleMap?: boolean;
    convertImage?: (image: {
      read: (type: string) => Promise<Buffer>;
      contentType: string;
    }) => Promise<{ src: string }>;
  }

  export function convertToHtml(input: InputOptions, options?: ConversionOptions): Promise<ConversionResult>;
  export function convertToMarkdown(input: InputOptions, options?: ConversionOptions): Promise<ConversionResult>;
  export function extractRawText(input: InputOptions): Promise<ConversionResult>;

  const mammoth: {
    convertToHtml: typeof convertToHtml;
    convertToMarkdown: typeof convertToMarkdown;
    extractRawText: typeof extractRawText;
  };

  export default mammoth;
}
