"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type ContactFormState = {
  name: string;
  email: string;
  message: string;
};

function ContactForm() {
  const { toast } = useToast();
  const [data, setData] = useState<ContactFormState>({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data.email || !data.message) {
      toast({
        title: "Заповніть обовʼязкові поля",
        description: "Будь ласка, вкажіть email і коротко опишіть запит.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      toast({
        title: "Дякуємо за звернення!",
        description:
          "Ми отримали ваше повідомлення і відповімо якнайшвидше.",
      });

      setData({
        name: "",
        email: "",
        message: "",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Помилка надсилання",
        description:
          "Не вдалося надіслати форму. Спробуйте ще раз або напишіть нам напряму на email.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Як до вас звертатися?</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Наприклад, Олександр"
          value={data.name}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email для відповіді *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={data.email}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Коротко опишіть запит *</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={4}
          placeholder="Що саме ви хотіли б отримати від TurbotaAI?"
          value={data.message}
          onChange={handleChange}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Надсилаємо..." : "Надіслати запит"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Надсилаючи форму, ви погоджуєтеся з політикою конфіденційності
        та умовами використання сервісу.
      </p>
    </form>
  );
}

export { ContactForm };
export default ContactForm;
