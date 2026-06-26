import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/images/hero-film-armani.png",
        search: "?v=202606262116",
      },
      {
        pathname: "/images/product-si-bloom.png",
        search: "",
      },
      {
        pathname: "/images/GIORGIO_ARMANI_LOGO_2019_B_Plan de travail 1.png",
        search: "",
      },
      {
        pathname: "/images/gall/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
