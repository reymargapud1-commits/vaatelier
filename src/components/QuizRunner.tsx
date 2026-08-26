"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface QuizData {
  id: string;
  title: string;
  passingScore: number;
  moduleTitle: string;
  questions: { id: string; text: string; choices: string[] }[];
}

interface SubmitResult {
  score: number;
  passed: boolean;
  passingScore: number;
  results: { questionId: string; correct: boolean; correctIndex: number }[];
  certificateIssued: boolean;
  certificatesIssued: string[];
}

export default function QuizRunner({ quizId }: { quizId: string }) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/quiz/${quizId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setQuiz(data);
      });
  }, [quizId]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!quiz) return <p className="text-gray-500">Loading quiz...</p>;

  const allAnswered = quiz.questions.every((_, i) => answers[i] !== undefined);

  async function handleSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    const ordered = quiz.questions.map((_, i) => answers[i]);
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: quiz.id, answers: ordered }),
    });
    const data = await res.json();
    setResult(data);
    setSubmitting(false);
  }

  if (result) {
    return (
      <div className="card text-center">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            result.passed ? "bg-emerald-100" : "bg-red-100"
          }`}
        >
          {result.passed ? "🎉" : "😕"}
        </div>
        <h2 className="mb-1 text-xl font-bold text-gray-900">
          {result.passed ? "Passed!" : "Not Quite Yet"}
        </h2>
        <p className="mb-4 text-gray-600">
          You scored {result.score}% (passing score is {result.passingScore}%).
        </p>

        {result.certificateIssued && (
          <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            🎓 Congratulations, you've earned{" "}
            {result.certificatesIssued.length > 1
              ? `${result.certificatesIssued.length} new certificates`
              : "a new certificate"}
            !
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {result.certificateIssued ? (
            <Link href="/dashboard/certificates" className="btn-primary">
              View Certificates
            </Link>
          ) : (
            <Link href="/dashboard" className="btn-primary">
              Back to Dashboard
            </Link>
          )}
          {!result.passed && (
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="btn-secondary"
            >
              Retake Quiz
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {quiz.questions.map((q, i) => (
        <div key={q.id} className="card">
          <p className="mb-3 font-semibold text-gray-900">
            {i + 1}. {q.text}
          </p>
          <div className="space-y-2">
            {q.choices.map((choice, ci) => (
              <label
                key={ci}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
                  answers[i] === ci
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${i}`}
                  className="accent-brand-600"
                  checked={answers[i] === ci}
                  onChange={() => setAnswers((prev) => ({ ...prev, [i]: ci }))}
                />
                {choice}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button onClick={handleSubmit} disabled={!allAnswered || submitting} className="btn-primary w-full">
        {submitting ? "Submitting..." : "Submit Quiz"}
      </button>
    </div>
  );
}
