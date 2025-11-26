import { ContactForm } from "@/components/contact-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

function ContactSection() {
  return (
    <section id="contact" className="py-24 bg-background">
      <div className="container mx-auto px-4 max-w-6xl grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
        <div className="space-y-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Поговорімо про TurbotaAI для вас
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Залиште контакти й кілька речень про свою ситуацію.
            Ми повернемося з коротким коментарем та варіантами наступних кроків:
            тестова сесія, демо продукту або консультація зі спеціалістом.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Відповідь зазвичай протягом 24 годин у робочі дні.</li>
            <li>• Уся інформація конфіденційна, без передачі третім сторонам.</li>
            <li>• Можемо відповідати українською та англійською.</li>
          </ul>
        </div>

        <Card className="border border-primary/20 shadow-lg shadow-primary/10">
          <CardHeader>
            <CardTitle className="text-xl">Коротка заявка</CardTitle>
            <CardDescription>
              Заповніть форму — ми підберемо формат співпраці саме під вас.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export { ContactSection };
export default ContactSection;
