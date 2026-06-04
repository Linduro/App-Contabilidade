export interface RadioStation {
  id: string
  label: string
  url: string
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: "lofi",
    label: "Lofi",
    url: "https://streams.ilovemusic.de/iloveradio17.mp3",
  },
  {
    id: "jazz",
    label: "Jazz",
    url: "https://ice1.somafm.com/jazz128-mp3",
  },
  {
    id: "classica",
    label: "Clássica",
    url: "https://ice1.somafm.com/classical128-mp3",
  },
  {
    id: "indie",
    label: "Indie",
    url: "https://ice1.somafm.com/indiepop-128-mp3",
  },
  {
    id: "ambient",
    label: "Ambiente",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
  },
]
