"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";
import { CreateCourseDialog } from "@/components/features/create-course";

// Replace with your real backend URL in prod
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function HomePage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [sql, setSql] = useState("SELECT * FROM data");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchCourse = () => {
    fetch(`${BACKEND_URL}/api/courses`)
      .then((res) => res.json())
      .then(setCourses)
      .catch((err) => console.error("Failed to fetch courses:", err));
  };

  // Load courses on mount
  useEffect(() => {
    fetchCourse();
  }, []);

  const runQuery = async () => {
    if (!selectedCourse?.id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/execute/${selectedCourse.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql }),
        }
      );
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Failed to execute query" });
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      {selectedCourse ? (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setSelectedCourse(null)}
        >
          Back to Course List
        </Button>
      ) : (
        <CreateCourseDialog onSuccess={fetchCourse} />
      )}

      <h1 className="text-2xl font-bold mb-4 mt-5">SQL Course POC</h1>

      {!selectedCourse && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Available Courses</h2>
          <ul className="space-y-2">
            {courses.map((course) => (
              <li key={course.id}>
                <Button onClick={() => setSelectedCourse(course)}>
                  {course.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedCourse && (
        <div>
          <h2 className="text-xl font-semibold mt-4">{selectedCourse.name}</h2>
          <p className="mb-4">{selectedCourse.description}</p>

          <Editor
            height="200px"
            language="sql"
            value={sql}
            onChange={(v) => setSql(v || "")}
            options={{ automaticLayout: true }}
          />

          <Button onClick={runQuery} className="mt-2" disabled={loading}>
            {loading ? "Running..." : "Run Query"}
          </Button>

          <div className="mt-4">
            {result?.error && (
              <div className="text-red-600 font-mono">{result.error}</div>
            )}

            {Array.isArray(result) && result.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      {Object.keys(result[0]).map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 border-b border-gray-300 text-left font-semibold"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((row, rowIndex) => (
                      <tr key={rowIndex} className="even:bg-gray-50">
                        {Object.values(row).map((val: any, colIndex) => (
                          <td
                            key={colIndex}
                            className="px-2 py-1 border-b border-gray-200"
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {Array.isArray(result) && result.length === 0 && (
              <p className="text-sm text-gray-500">No results returned.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
