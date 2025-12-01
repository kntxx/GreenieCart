// src/types/paymongo.d.ts
declare module 'paymongo' {
  interface PayMongoClient {
    paymentIntent: {
      create(data: any): Promise<any>;
      attach(id: string, data: any): Promise<any>;
      retrieve(id: string): Promise<any>;
    };
    paymentMethod: {
      create(data: any): Promise<any>;
    };
  }

  function PayMongo(secretKey: string): PayMongoClient;
  export default PayMongo;
}