import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HeartHandshake, Stethoscope } from "lucide-react";
import TermsModal from "@/components/TermsModal";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function RoleSelector() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <TermsModal />
      <div className="relative z-10 w-full max-w-2xl text-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="mb-2 font-display text-4xl font-extrabold text-foreground sm:text-5xl">Playground Life</h1>
          <p className="mb-10 text-base text-muted-foreground sm:mb-12 sm:text-lg">
            AAC-enabled guided play for home and clinic
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <motion.button
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/therapist")}
            className="touch-target rounded-2xl border border-white/40 bg-primary/90 p-6 text-primary-foreground shadow-[0_18px_50px_rgba(77,170,206,0.28)] backdrop-blur-md sm:p-8"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-white/60">
              <Stethoscope size={28} strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 className="mb-2 font-display text-2xl font-bold">Therapist</h2>
            <p className="text-sm opacity-90">Assign homework & classwork, track progress, generate reports</p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/family")}
            className="touch-target rounded-2xl border border-white/40 bg-secondary/90 p-6 text-secondary-foreground shadow-[0_18px_50px_rgba(102,190,132,0.26)] backdrop-blur-md sm:p-8"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-secondary shadow-sm ring-1 ring-white/60">
              <HeartHandshake size={28} strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 className="mb-2 font-display text-2xl font-bold">Family</h2>
            <p className="text-sm opacity-90">View homework, play games with your child at home</p>
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-8 flex items-center justify-center"
        >
          <button
            onClick={() => navigate("/admin")}
            className="touch-target rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:bg-card/70 hover:text-foreground"
          >
            Clinic Admin · caseloads
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-4 flex items-center justify-center"
        >
          <button
            onClick={() => navigate("/")}
            className="touch-target inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent/15 hover:text-foreground"
          >
            ← Back to home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
