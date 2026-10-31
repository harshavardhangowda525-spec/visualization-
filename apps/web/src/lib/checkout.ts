import { api } from "./api";
declare global {
  interface Window {
    Razorpay: any;
  }
}
let loading: Promise<void> | null = null;
export async function checkout(order: any) {
  if (!window.Razorpay) {
    loading ||= new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error("Unable to load secure checkout"));
      };
      document.head.appendChild(s);
    });
    await loading;
  }
  return new Promise<any>((resolve, reject) => {
    const r = new window.Razorpay({
      key: order.key,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Studio booking",
      handler: async (response: any) => {
        try {
          resolve(await api("/payments/verify", response));
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () =>
          reject(
            new Error("Checkout closed. Your hold will expire automatically."),
          ),
      },
      theme: { color: "#9b763d" },
    });
    r.on("payment.failed", () =>
      reject(
        new Error(
          "Payment failed. You can safely retry while your hold is active.",
        ),
      ),
    );
    r.open();
  });
}
