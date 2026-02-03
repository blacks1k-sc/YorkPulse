"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, ShoppingBag, Users, MessageCircle } from "lucide-react";

const features = [
  {
    href: "/vault",
    icon: Shield,
    title: "The Vault",
    description: "Anonymous discussions. No tracking, no judgment.",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-500/50",
    hoverGlow: "hover:shadow-purple-500/20",
  },
  {
    href: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy and sell with verified students only.",
    iconBg: "bg-coral/10",
    iconColor: "text-coral",
    hoverBorder: "hover:border-coral/50",
    hoverGlow: "hover:shadow-coral/20",
  },
  {
    href: "/quests",
    icon: Users,
    title: "Side Quests",
    description: "Find gym partners, study buddies, and more.",
    iconBg: "bg-green-500/10",
    iconColor: "text-green-500",
    hoverBorder: "hover:border-green-500/50",
    hoverGlow: "hover:shadow-green-500/20",
  },
  {
    href: "/messages",
    icon: MessageCircle,
    title: "Messaging",
    description: "Request-based DMs. You control who can reach you.",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    hoverBorder: "hover:border-blue-500/50",
    hoverGlow: "hover:shadow-blue-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 gradient-mesh" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8 flex justify-center"
            >
              <div className="gradient-purple rounded-2xl p-4">
                <span className="text-4xl font-bold text-white">YP</span>
              </div>
            </motion.div>

            {/* Title */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Your Campus.{" "}
              <span className="bg-gradient-to-r from-purple-500 to-coral bg-clip-text text-transparent">
                Your Community.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              YorkPulse is the exclusive platform for York University students.
              Connect, trade, and build lasting friendships in a safe, verified community.
            </p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex items-center justify-center gap-x-6"
            >
              <Link
                href="/auth/signup"
                className="gradient-purple rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="glass rounded-xl px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-white/10"
              >
                Sign In
              </Link>
            </motion.div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto mt-20 max-w-5xl"
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <motion.div key={feature.href} variants={itemVariants}>
                  <Link href={feature.href}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`glass-card p-6 cursor-pointer transition-all duration-300 border border-white/10 ${feature.hoverBorder} ${feature.hoverGlow} hover:shadow-lg`}
                    >
                      <div className={`mb-4 inline-flex rounded-lg ${feature.iconBg} p-3`}>
                        <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                      </div>
                      <h3 className="font-semibold text-foreground">{feature.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Trust Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mx-auto mt-16 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Verified with <span className="font-semibold text-foreground">@yorku.ca</span> or <span className="font-semibold text-foreground">@my.yorku.ca</span> email
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
