declare module 'googleapis' {
  export const google: {
    auth: {
      GoogleAuth: new (options: {
        keyFile: string;
        scopes: string[];
      }) => any;
    };
    sheets: (options: { version: string; auth: any }) => {
      spreadsheets: {
        values: {
          get: (params: {
            spreadsheetId: string;
            range: string;
          }) => Promise<{
            data: {
              values: any[][];
            };
          }>;
          update: (params: {
            spreadsheetId: string;
            range: string;
            valueInputOption: string;
            resource: {
              values: any[][];
            };
          }) => Promise<any>;
        };
      };
    };
  };
} 