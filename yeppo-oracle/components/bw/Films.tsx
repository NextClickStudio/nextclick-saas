"use client";

import { Player } from "@/components/film/engine";
import { filmInstall } from "@/components/film/FilmInstall";
import { filmRadar } from "@/components/film/FilmRadar";
import { filmRead } from "@/components/film/FilmRead";
import { filmX } from "@/components/film/FilmX";

/** the four films of the home, in the order a new user meets them */
export default function Films() {
  return <Player films={[filmRead, filmRadar, filmX, filmInstall]} />;
}
