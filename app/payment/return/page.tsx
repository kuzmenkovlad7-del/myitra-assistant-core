import Link from "next/link"

export default function PaymentReturnPage({
  searchParams,
}: {
  searchParams?: { orderReference?: string }
}) {
  const orderReference = searchParams?.orderReference || ""

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-xl w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Оплата обрабатывается</h1>

        <p className="mt-3 text-gray-600">
          Если оплата прошла, доступ активируется автоматически через несколько секунд.
        </p>

        {orderReference ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-800">
            <div className="font-medium">Order reference</div>
            <div className="break-all">{orderReference}</div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            Не найден orderReference в URL.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/profile"
            className="w-full rounded-xl bg-black px-4 py-3 text-center text-white hover:opacity-90"
          >
            Перейти в профиль
          </Link>

          <Link
            href="/pricing"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-gray-800 hover:bg-gray-50"
          >
            Назад к тарифам
          </Link>
        </div>
      </div>
    </main>
  )
}
