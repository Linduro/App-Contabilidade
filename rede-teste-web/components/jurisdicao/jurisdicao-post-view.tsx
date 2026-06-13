"use client";

import { type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { JurisdicaoPostCard } from "./jurisdicao-post-card";
import { type JrdPost, jrdFontStack } from "./jurisdicao-utils";

export function JurisdicaoPostView({ handle, id }: { handle: string; id: string }) {
  const blogQ = trpc.jurisdicao.getBlogByHandle.useQuery({ handle });
  const postQ = trpc.jurisdicao.getPost.useQuery({ id });

  if (blogQ.isLoading || postQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-900">
        <Loader2 className="size-6 animate-spin text-white/70" />
      </div>
    );
  }
  if (!blogQ.data || !postQ.data) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-900 px-4 text-center text-white/80">
        <div>
          <p className="text-lg font-bold">Post não encontrado</p>
          <Link href={`/jurisdicao/${handle}`} className="mt-2 inline-block text-sky-300 hover:underline">
            Voltar ao blog
          </Link>
        </div>
      </div>
    );
  }

  const blog = blogQ.data;
  const rootStyle: CSSProperties = {
    background: blog.bgColor,
    color: blog.textColor,
    fontFamily: jrdFontStack(blog.fontFamily),
    ...(blog.bgImageUrl
      ? { backgroundImage: `url(${blog.bgImageUrl})`, backgroundAttachment: "fixed" }
      : {}),
  };

  return (
    <div className="min-h-screen" style={rootStyle}>
      <div className="mx-auto max-w-[560px] space-y-4 px-4 py-8">
        <Link
          href={`/jurisdicao/${blog.handle}`}
          className="inline-flex items-center gap-1 text-sm font-bold opacity-90 hover:opacity-100"
        >
          <ArrowLeft className="size-4" />
          {blog.title}
        </Link>
        <JurisdicaoPostCard
          post={postQ.data as unknown as JrdPost}
          accent={blog.accentColor}
          canDelete={blog.isOwner}
        />
      </div>
    </div>
  );
}
